function sendGet(url) {
  const xhr = new XMLHttpRequest()
  xhr.open("GET", url, true)
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4 && xhr.status === 200) {
      console.log(xhr.responseText)
    }
  } 
  xhr.send()
}

function sendPost(url, data) {
  const xhr = new XMLHttpRequest()
  xhr.open("POST", url, true)
  xhr.setRequestHeader("Content-Type", "application/json")
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4 && xhr.status === 200) {
      console.log(xhr.responseText)
    }
  }
  xhr.send(JSON.stringify(data))
}

function ajax(options) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(options.method || "GET", options.url, true)
    if (options.method === 'POST') {
      xhr.setRequestHeader("Content-Type", "application/json")
    }
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.responseText);
        } else {
          reject(new Error(`Request failed with status ${xhr.status}`));
        }
      }
    };
    xhr.send(options.method === "POST" ? JSON.stringify(options.data) : null);
  })
}

function jsonp(url, callbackName) {
  const script = document.createElement('script')
  script.src = `${url}?callback=${callbackName}`
  document.body.appendChild(script)
}

const handlerCallback = (data) => {
  console.log(data)
}

function loadResources(urls) {
  let loaded = 0

  urls.forEach(url => {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", url, true)
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        loaded++
      }
      if (loaded === urls.length) {
        console.log('All resources loaded')
      }
      xhr.send()
    }
  })
}

function sendRequestWithTimeout (url, timeout) {
  const xhr = new XMLHttpRequest()
  const timeoutId = setTimeout(() => {
    xhr.abort()
  }, timeout)
  xhr.open('GET', url, true)
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      clearTimeout(timeoutId)
      if (xhr.status === 200) {
        console.log(xhr.responseText)
      } else {
        console.log(`Error: ${xhr.status}`)
      }
    }
  }
}

function requestQueue(request) {
  let queue = Promise.resolve()

  request.forEach(req => {
    queue = queue.then(() => {
      return sendRequestWithTimeout(req.url, req.timeout)
    })
  })

  return queue
}