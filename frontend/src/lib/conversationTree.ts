import { Message } from "@/types";

export interface SiblingInfo {
  current: number;
  total: number;
  siblingIds: string[];
}

export interface TreeThreadResult {
  activeMessages: Message[];
  activeLeafId: string | null;
  siblingInfoMap: Record<string, SiblingInfo>;
}

/**
 * 规范化消息列表：对于历史中缺少 parent_id 的旧数据，自动按时间线性链式推导补全 parent_id，
 * 确保历史会话与多分支机制 100% 向后兼容。
 */
export function normalizeMessageParents(rawMessages: Message[]): Message[] {
  if (!rawMessages || rawMessages.length === 0) return [];

  // 1. 确保所有消息都有唯一 ID（避免刚创建的乐观消息缺少 ID 导致图节点丢失）
  const withIds = rawMessages.map((msg, idx) => {
    if (!msg.id) {
      return { ...msg, id: `client_optimistic_${idx}_${msg.created_at || Date.now()}` };
    }
    return msg;
  });

  // 2. 补全缺失 parent_id 的历史遗留消息（确保旧会话和新消息混排时链条不断裂）
  return withIds.map((msg, idx) => {
    if (idx === 0) return msg;
    if (!msg.parent_id) {
      return { ...msg, parent_id: withIds[idx - 1].id || null };
    }
    return msg;
  });
}

/**
 * 从完整的会话消息集合中，根据当前选中的叶子节点或分支选择，提取当前活跃路径（主线对话），
 * 并为每个节点计算其版本分支信息（如第 1/2 个版本）。
 */
export function getActiveThread(
  rawMessages: Message[],
  targetLeafId?: string | null,
  branchSelections: Record<string, string> = {}
): TreeThreadResult {
  const messages = normalizeMessageParents(rawMessages);
  if (messages.length === 0) {
    return { activeMessages: [], activeLeafId: null, siblingInfoMap: {} };
  }

  const idMap = new Map<string, Message>();
  const childrenMap = new Map<string, Message[]>();
  const roots: Message[] = [];

  messages.forEach((m) => {
    if (m.id) idMap.set(m.id, m);
  });

  messages.forEach((m) => {
    const parentId = m.parent_id || "";
    if (!parentId || !idMap.has(parentId)) {
      roots.push(m);
    } else {
      const list = childrenMap.get(parentId) || [];
      list.push(m);
      childrenMap.set(parentId, list);
    }
  });

  // 如果指定了目标叶子节点，且该节点在树中存在：
  // 检查该节点是否已经被后续新消息作为 parent 延伸；如果是，沿着分支选择向下延伸至最新叶子
  let effectiveTargetLeafId = targetLeafId;
  if (effectiveTargetLeafId && idMap.has(effectiveTargetLeafId)) {
    let curr = effectiveTargetLeafId;
    const visitedDown = new Set<string>();
    while (curr && !visitedDown.has(curr)) {
      visitedDown.add(curr);
      const kids = childrenMap.get(curr) || [];
      if (kids.length === 0) break;
      kids.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const chosen = branchSelections[curr];
      const nextKid = (chosen && idMap.get(chosen)) || kids[kids.length - 1];
      if (nextKid?.id) {
        curr = nextKid.id;
        effectiveTargetLeafId = curr;
      } else {
        break;
      }
    }
  }

  // 沿着 parent_id 链向上追溯至根节点
  let activePath: Message[] = [];
  if (effectiveTargetLeafId && idMap.has(effectiveTargetLeafId)) {
    let curr: Message | undefined = idMap.get(effectiveTargetLeafId);
    const visited = new Set<string>();
    while (curr && curr.id && !visited.has(curr.id)) {
      visited.add(curr.id);
      activePath.unshift(curr);
      curr = curr.parent_id ? idMap.get(curr.parent_id) : undefined;
    }
  }

  // 如果没有指定叶子或叶子无效，从根节点向下沿着分支选择（或最新分支）走到最深叶子
  if (activePath.length === 0 && roots.length > 0) {
    roots.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    let currNode: Message | undefined = roots[roots.length - 1];

    const selectedRootId = branchSelections["__root__"];
    if (selectedRootId && idMap.has(selectedRootId)) {
      currNode = idMap.get(selectedRootId);
    }

    const visited = new Set<string>();
    while (currNode && !visited.has(currNode.id || "")) {
      if (currNode.id) visited.add(currNode.id);
      activePath.push(currNode);

      const children = currNode.id ? childrenMap.get(currNode.id) || [] : [];
      if (children.length === 0) break;

      children.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
      const chosenChildId = currNode.id ? branchSelections[currNode.id] : undefined;
      const nextNode = (chosenChildId && idMap.get(chosenChildId)) || children[children.length - 1];
      currNode = nextNode;
    }
  }

  // 计算分支信息（同父级、同角色的兄弟消息为同级分支）
  const siblingInfoMap: Record<string, SiblingInfo> = {};
  activePath.forEach((msg) => {
    if (!msg.id) return;
    const parentKey = msg.parent_id || "__root__";

    const siblings = messages.filter((m) => {
      const mParent = m.parent_id || "__root__";
      return mParent === parentKey && m.role === msg.role;
    });

    siblings.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

    if (siblings.length > 1) {
      const idx = siblings.findIndex((s) => s.id === msg.id);
      siblingInfoMap[msg.id] = {
        current: idx !== -1 ? idx + 1 : 1,
        total: siblings.length,
        siblingIds: siblings.map((s) => s.id || "").filter(Boolean),
      };
    }
  });

  const activeLeafId = activePath.length > 0 ? activePath[activePath.length - 1].id || null : null;

  return {
    activeMessages: activePath,
    activeLeafId,
    siblingInfoMap,
  };
}

/**
 * 用户点击切换分支（如切换到同级第 2 个版本时），寻找目标节点下的最新叶子节点 ID
 */
export function findDeepestLeafOfNode(messages: Message[], targetNodeId: string): string {
  const idMap = new Map<string, Message>();
  const childrenMap = new Map<string, Message[]>();

  messages.forEach((m) => {
    if (m.id) idMap.set(m.id, m);
    const parentId = m.parent_id || "";
    if (parentId) {
      const list = childrenMap.get(parentId) || [];
      list.push(m);
      childrenMap.set(parentId, list);
    }
  });

  let currId = targetNodeId;
  const visited = new Set<string>();

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    const children = childrenMap.get(currId) || [];
    if (children.length === 0) break;

    children.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    currId = children[children.length - 1].id || currId;
  }

  return currId;
}
