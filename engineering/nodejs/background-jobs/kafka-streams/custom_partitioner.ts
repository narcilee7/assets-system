export function userPartitioner(partitionCount: number) {
  return (message: { key?: string }) => {
    if (!message.key) return 0;
    // 简单的 hash 分区
    let hash = 0;
    for (const char of message.key) {
      hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }
    return Math.abs(hash) % partitionCount;
  };
}
