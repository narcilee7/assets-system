package main

import (
	"fmt"
	forloop "language-go/01/for_loop"
	grountinewithchannel "language-go/01/grountine_with_channel"
	"language-go/01/modules"
	"language-go/01/types"
	"language-go/01/variable"
)

// module
func initModuleTest() {
	modules.AInitTrigger()
	modules.BInitTrigger()
}

// variable
func testVariable() {
	variable.DefineConstants()
	variable.DefineVariables()
}

func testTypes() {
	types.DefineBasicType()
	types.DefineComplexType()
	types.StringTest()
}

func testForLoop() {
	forloop.TestForLoop()
}

func main() {
	// module init test
	// initModuleTest()

	// variable test
	// testVariable()

	// types test
	// testTypes()

	// for loop test
	// testForLoop()

	// pointer
	// pointer.TestPointer()
	// pointer.DebugLoopvariable()
	// pointer.DebugNil()

	// array and slice
	// arrayandslice.TestArray()
	// arrayandslice.TestSlice()
	// arrayandslice.DebugNil()

	// gorountine with channel
	// grountinewithchannel.DebugGorountine()
	grountinewithchannel.DebugGorountineBad()
	fmt.Print("go language philosophy end\n")
}
