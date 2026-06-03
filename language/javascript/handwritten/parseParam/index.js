/**
 * 解析URL参数为对象
 */

function parseParam(url) {
  const paramsStr = /.+\?(.+)$/.exec(url)[1];
  const paramsArr = paramsStr.split('&');
  let paramsObj = {};

  paramsArr.forEach(param => {
    if (/=/.test(param)) {
      let [key, value] = param.split('=');
      val = decodeURIComponent(value);
      val = /^\d+$/.test(val) ? parseFloat(val) : val;

      if (paramsObj.hasOwnProperty(key)) {
        paramsObj[key] = [].concat(paramsObj[key], val);
      } else {
        paramsObj[key] = val;
      }
    } else {
      paramsObj[param] = true;
    }
  })

  return paramsObj;
}

console.log(parseParam('http://www.nowcoder.com?name=zhangsan&age=18&gender=male&hobby=sing,swim,run&addr=beijing'));