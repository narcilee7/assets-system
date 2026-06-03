package types

import (
	"fmt"
)

func DefineBasicType() {
	var bool = true
	fmt.Println("bool is %t", bool)

	var int int = 42
	fmt.Println("int is %d", int)

	var int8 int8 = 42
	fmt.Println("int8 is %d", int8)

	var int16 int16 = 42
	fmt.Println("int16 is %d", int16)

	var int32 int32 = 42
	fmt.Println("int32 is %d", int32)

	var int64 int64 = 42
	fmt.Println("int64 is %d", int64)

	var uint uint = 42
	fmt.Println("uint is %d", uint)

	var uint8 uint8 = 42
	fmt.Println("uint8 is %d", uint8)

	var float32 float32 = 4.2
	fmt.Println("float32 is %f", float32)

	var float64 float64 = 4.2
	fmt.Println("float64 is %f", float64)

	var complex64 complex128 = 4.2 + 4.2i
	fmt.Println("complex64 is %f", complex64)

	var complex128 complex128 = 4.2 + 4.2i
	fmt.Println("complex128 is %f", complex128)

	var string string = "this is a string"
	fmt.Println("string is %s", string)

	var byte byte = 42
	fmt.Println("byte is %d", byte)

	var rune rune = 42
	fmt.Println("rune is %d", rune)
}

func DefineComplexType() {
	var array []int = []int{1, 2, 3}
	fmt.Println("array is %v", array)

	var slice []int = array[1:3]
	fmt.Println("slice is %v", slice)

	var myMap map[string]int = map[string]int{"a": 1, "b": 2}
	fmt.Println("map is %v", myMap)

	var myStruct struct {
		a int
		b int
	}
	fmt.Println("empty my struct is %v", myStruct)
	myStruct.a = 1
	myStruct.b = 2
	fmt.Println("struct is %v", myStruct)

	var intValue = 2
	var intPtr = &intValue
	fmt.Println("intPtr value is %d", *intPtr)
	fmt.Println("intPtr address is %p", intPtr)
	fmt.Println("intValue value is %d", intValue)

	var function = func() {
		fmt.Print("this is inner func")
	}
	fmt.Println("function is %v", function)

	var channel = make(chan int, 1)
	fmt.Println("channel is ", channel)
	channel <- 42
	fmt.Println("channel is ", channel)

	var value = <-channel
	fmt.Println("after channel copy, value is ", value)

	var interfaceV interface{} = map[string]int{"a": 1, "b": 2}
	fmt.Println("interfaceV is %v", interfaceV)

	var mapValue = interfaceV.(map[string]int)
	fmt.Println("mapValue is %v", mapValue)
}
