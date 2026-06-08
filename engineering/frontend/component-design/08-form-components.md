# 表单组件

## 1. Form Context 设计

```tsx
// FormContext.tsx
import { createContext, useContext, useState, useCallback } from 'react';

interface FieldState {
  value: string;
  error?: string;
  touched: boolean;
}

interface FormContextValue {
  values: Record<string, string>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  setValue: (name: string, value: string) => void;
  setError: (name: string, error: string) => void;
  setTouched: (name: string) => void;
  validate: () => boolean;
}

const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('Must be used within <Form>');
  return ctx;
}

// Form 组件
interface FormProps {
  initialValues: Record<string, string>;
  validate?: (values: Record<string, string>) => Record<string, string>;
  onSubmit: (values: Record<string, string>) => void;
  children: React.ReactNode;
}

export function Form({ initialValues, validate, onSubmit, children }: FormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // 清除错误
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const setError = useCallback((name: string, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const setTouchedField = useCallback((name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const handleValidate = useCallback(() => {
    if (!validate) return true;
    const validationErrors = validate(values);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  }, [validate, values]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handleValidate()) {
      onSubmit(values);
    }
  };

  return (
    <FormContext.Provider
      value={{ values, errors, touched, setValue, setError, setTouched: setTouchedField, validate: handleValidate }}
    >
      <form onSubmit={handleSubmit} noValidate>
        {children}
      </form>
    </FormContext.Provider>
  );
}
```

## 2. Field 组件

```tsx
// Field.tsx
interface FieldProps {
  name: string;
  label?: string;
  validate?: (value: string) => string | undefined;
  children: (props: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    error?: string;
  }) => React.ReactNode;
}

export function Field({ name, label, validate, children }: FieldProps) {
  const { values, errors, touched, setValue, setError, setTouched } = useFormContext();

  const value = values[name] || '';
  const error = touched[name] ? errors[name] : undefined;

  const handleChange = (newValue: string) => {
    setValue(name, newValue);
    if (validate) {
      const fieldError = validate(newValue);
      if (fieldError) setError(name, fieldError);
    }
  };

  const handleBlur = () => {
    setTouched(name);
    if (validate) {
      const fieldError = validate(value);
      if (fieldError) setError(name, fieldError);
    }
  };

  return (
    <div className="field">
      {label && <label htmlFor={name}>{label}</label>}
      {children({ name, value, onChange: handleChange, onBlur: handleBlur, error })}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// ============ 使用 ============

function LoginForm() {
  return (
    <Form
      initialValues={{ email: '', password: '' }}
      validate={(values) => {
        const errors: Record<string, string> = {};
        if (!values.email) errors.email = 'Required';
        if (!values.password) errors.password = 'Required';
        return errors;
      }}
      onSubmit={(values) => console.log(values)}
    >
      <Field
        name="email"
        label="Email"
        validate={(v) => (!v.includes('@') ? 'Invalid email' : undefined)}
      >
        {({ name, value, onChange, onBlur, error }) => (
          <input
            id={name}
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            aria-invalid={error ? 'true' : 'false'}
          />
        )}
      </Field>

      <Field name="password" label="Password">
        {({ name, value, onChange, onBlur, error }) => (
          <input
            id={name}
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      </Field>

      <button type="submit">Login</button>
    </Form>
  );
}
```
