var chunkSize = 1 * 1024 * 1024;
var uploadResult = document.getElementById("uploadResult")
var fileMd5Span = document.getElementById("fileMd5")
var checkFileRes = document.getElementById("checkFileRes")
var fileMd5;


function mainUploadFile() {

}

function getFileMD5(file) {
    return new Promise((resolve, reject) => {
        let fileReader = new FileReader()
        fileReader.onload = (e) => {
            let fileMd5 = SparkMD5.ArrayBuffer.hash(e.target.result)
            resolve(fileMd5)
        }
        fileReader.onerror = (e) => {
            reject(e)
        }
        fileReader.readAsArrayBuffer(file)
    })
}

function upload(data) {
    const xhr = new XMLHttpRequest()
    xhr.onload = () => {
        if (xhr.status === 200) {
            uploadResult.append('上传成功分片：' + data.get("chunkNumber") + '\t')
        }
    }
    xhr.onerror = () => {
        uploadResult.innerHTML = '上传失败'
    }
    xhr.open('POST', '/uploadBig', true)
    xhr.send(data)
}

function checkFile() {
    const xhr = new XMLHttpRequest()
    xhr.onload = () => {
        if (xhr.status === 200) {
            checkFileRes.innerHTML = xhr.responseText
        }
    }
    xhr.onerror = () => {
        checkFileRes.innerHTML = '检查失败'
    }
    xhr.open('POST', '/checkFile', true)
    xhr.send(fileMd5)
    console.log('检查文件')
}