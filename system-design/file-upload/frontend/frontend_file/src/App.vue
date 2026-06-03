<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <el-progress
        v-if="progress > 0"
        :percentage="progress"
        :status="progress === 100 ? 'success' : 'active'"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import axios from 'axios'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB per chunk
const progress = ref(0)

const getFileIdentifier = (file: File) => file.name

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const objectName = file.name
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const identifier = getFileIdentifier(file)

  try {
    for (let chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++) {
      const start = (chunkNumber - 1) * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('chunkNumber', chunkNumber.toString())
      formData.append('totalChunks', totalChunks.toString())
      formData.append('identifier', identifier)
      formData.append('fileName', objectName)
      formData.append('file', chunk)

      await axios.post('/upload/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      progress.value = Math.floor((chunkNumber / totalChunks) * 100)
    }

    // 调用合并接口
    await axios.post('/upload/merge', {
      identifier,
      totalChunks,
      fileName: objectName
    })

    progress.value = 100
    alert('上传完成')
  } catch (error) {
    console.error('上传失败', error)
    alert('上传失败，请重试')
    progress.value = 0
  }
}
</script>
