package errors

import (
	"errors"
	"fmt"
)

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

func DebugCustomError(err error) {
	var ve *ValidationError
	if errors.As(err, &ve) {
		fmt.Println(ve)
	}
}
