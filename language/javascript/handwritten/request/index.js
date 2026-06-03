const requestWithInterval = async (url, options, interval = 1000, maxCount = 3) => {
  let attempt = 0
  while (attempt < maxCount) {
    try {
      const res = await fetch(url, options)
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }
      return await res.json()
    } catch (error) {
      attempt++
      if (attempt === maxCount) {
        throw error
      }
      const delay = interval * attempt
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

const reImplements = async (url, options, interval = 1000, maxCount = 3) => {
  let attempt = 0
  while (attempt < maxCount) {
    try {
      const res = await fetch(url, options)
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }
      return await res.json()
    } catch (error) {
      attempt++
      if (attempt === maxCount) {
        throw error
      }
      const delay = interval * attempt
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}