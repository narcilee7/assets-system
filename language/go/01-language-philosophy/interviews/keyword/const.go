package keyword

const a = 10
const b int = 20

var f float32 = a
// var f2 float32 = b // 不合法：无类型常量赋值的时候要显式转换
var f2 float32 = float32(b)

var i1 int8 = a
// var i2 int8 = b

var i2 int8 = int8(b)
