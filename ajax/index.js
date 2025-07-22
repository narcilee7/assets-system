/**
 * Ajax
 */


// 发送GET请求
function sendGET(url) {
  const xhr = new XMLHttpRequest()

  xhr.open("GET", url, true)

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      console.log(xhr.responseText)
    }
  }

  // 发送
  xhr.send()
}

// 发送POST请求
function sendPOST(url, data) {
  const xhr = new XMLHttpRequest()
  xhr.open("POST", url, true)
  xhr.setRequestHeader('Content-Type', "application/json")
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      console.log(xhr.responseText)
    }
  };
  xhr.send(JSON.stringify(data))
}

/**
 * 手写一个AJAX请求的封装
 * 请手写一个函数，用于封装 AJAX 请求，支持 GET 和 POST 方法，支持返回 Promise。
 */
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

/**
 * 手写一个 JSONP 请求
 */
function jsonp(url, callbackName) {
  const script = document.createElement('script')
  script.src = `${url}?callback=${callbackName}`
  document.body.appendChild(script)
}

const handleJsonpCallback = () => {
  console.log('jsonp callback')
}

jsonp('https://api.example.com/data', 'handleData')

/**
 * 手写一个简单的AJAX加载器
 */

function loadResources(urls) {
  let loaded = 0
  const total = urls.length

  urls.forEach(url => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        loaded++
      }

      xhr.send()
    }
  })
}

/**
 * 手写支持超时和取消的AJAX
 */

function sendRequestWithTimeout(url, timeout) {
  const xhr = new XMLHttpRequest()
  const timeoutId = setTimeout(() => {
    xhr.abort()
    console.log('Request timeout')
  }, timeout ?? 300)
  xhr.open('GET', url, true)
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      clearTimeout(timeoutId); // 清除超时计时器
      if (xhr.status === 200) {
        console.log(xhr.responseText);
      } else {
        console.log(`Error: ${xhr.status}`);
      }
    }
  }
  xhr.send()
}

function requestQueue(requests) {
  let queue = Promise.resolve()

  requests.forEach(req => {
    queue = queue.then(() => {
      return sendRequest(req)
    })
  })

  function sendRequest(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("GET", url, true)
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            resolve(xhr.responseText)
          } else {
            reject(new Error('Request failed'));
          }
        }
      }
      xhr.send()
    })
  }
}