package function

import "errors"

// 函数声明
func add(a, b int) int {
	return a + b
}

func devide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	return a / b, nil
}

func split(sum int) (x, y int) {
	x = sum * 4 / 9
	y = sum - x
	return
}

func sum(nums ...int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

func TestFunction() {
	result := sum(1, 2, 3, 4, 5)
	_ = result

	if result != 15 {
		panic("result is not 15")
	}
}
