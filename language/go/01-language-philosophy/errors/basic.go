package errors

import (
	"fmt"
	"os"
)

func openFile() error {

	f, err := os.Open("file.txt")

	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	return nil
}
