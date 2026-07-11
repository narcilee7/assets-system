file = inode + datablocks

directory = key-value table(key: fileName, value: inode)

inode:
  - file-metadata: 
    - size
    - i_mode
    - i_timestamp
    - uid
  - datablocks pointer
  - inode number

datablocks:
  - 实际上存储文件内容的磁盘块
  - inode的指针指向这些块的地址


目录：
  - 特殊的文件，内容是“文件名 -> inode number”的映射
  - ls的顺序：
    - 读取目录文件找到inode
    - 根据inode找到inode-metadata->datablocks


virtual file system = 所有文件系统的接口


interface fileOperations {
  open(fileName: string): 
  read(fileName: string, offset: number, length: number): 
  write(fileName: string, offset: number, data: string): 
  close(fileName: string): 
}

核心结构：
  - superblock：文件系统全局的信息(块的大小、inode总数、空闲的块)
  - inode：文件的元数据和块指针
  - dentry：目录项缓存(路径->inode的映射)
  - file：打开文件的实例

关系：
路径：/a/b/c
  -> 查找 dentry cache
  -> / -> a -> b -> c
  -> 每个dentry指向一个inode
  -> inode指向superblocks和data blocks

### dentry cache

目的是：加速路径解析

/example/path/file.txt

解析过程：
  / -> dentry "/" -> inode 2
  example -> dentry "example" -> inode 3
  path -> dentry "path" -> inode 4
  file.txt -> dentry "file.txt" -> inode 5

缓存命中：O(1) 直接拿到 inode
缓存未命中：逐级读取磁盘目录块


## Page cache

Page Cache = 文件数据的内核缓存(内存中的磁盘数据)

读文件：
  1. 检查 page cache 是否有该文件的页
  2. 命中：直接从内存返回，零磁盘 I/O
  3. 未命中：从磁盘读取，放入 page cache，再返回

写文件：
  1. 拷贝数据到 page cache（标记为 dirty）
  2. 立即返回 write() 调用（异步）
  3. 后台 flush 线程定期把 dirty page 刷盘
  4. 或者 fsync() 强制刷盘
