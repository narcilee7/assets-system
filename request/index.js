async function requestWithRetry(
  url,
  options = {},
  retryCount = 3,
  interval = 1000
) {
  let attempt = 0

  while (attempt < retryCount) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      attempt++
      if (attempt >= retryCount) {
        throw error
      }
      const delay = interval * Math.pow(2, attempt)
      console.log(`Attempt ${attempt} failed. Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}