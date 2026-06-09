# 手写 Form Context

## 1. 完整 Form 系统

```tsx
// FormSystem.tsx
import { createContext, useContext, useState, useCallback, useRef } from 'react';

// ============ Types ============
interface FieldMeta {
  value: string;
  error?: string;
  touched: boolean;
  dirty: boolean;
  validators: Array<(value: string) => string | undefined>;
}

interface FormState {
  fields: Record<string, FieldMeta>;
  isSubmitting: boolean;
  isValid: boolean;
}

interface FormContextValue {
  state: FormState;
  register: (name: string, validators?: FieldMeta['validators']) => void;
  setValue: (name: string, value: string) => void;
  setTouched: (name: string) => void;
  addValidator: (name: string, validator: (value: string) => string | undefined) => void;
  validateField: (name: string) => boolean;
  validateAll: () => boolean;
  handleSubmit: (onSubmit: (values: Record<string, string>) => void) => (e: React.FormEvent) => void;
  getFieldProps: (name: string) => {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    error?: string;
  };
}

// ============ Context ============
const FormContext = createContext<FormContextValue | null>(null);

function useForm() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useForm must be used within <FormProvider>');
  return ctx;
}

// ============ Provider ============
interface FormProviderProps {
  children: React.ReactNode;
  initialValues?: Record<string, string>;
}

function FormProvider({ children, initialValues = {} }: FormProviderProps) {
  const [fields, setFields] = useState<Record<string, FieldMeta>>(() => {
    const initial: Record<string, FieldMeta> = {};
    for (const [name, value] of Object.entries(initialValues)) {
      initial[name] = {
        value,
        touched: false,
        dirty: false,
        validators: [],
      };
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const register = useCallback((name: string, validators: FieldMeta['validators'] = []) => {
    setFields((prev) => ({
      ...prev,
      [name]: prev[name] || { value: '', touched: false, dirty: false, validators },
    }));
  }, []);

  const setValue = useCallback((name: string, value: string) => {
    setFields((prev) => {
      const field = prev[name];
      if (!field) return prev;

      // 运行时校验
      let error: string | undefined;
      for (const validator of field.validators) {
        error = validator(value);
        if (error) break;
      }

      return {
        ...prev,
        [name]: {
          ...field,
          value,
          dirty: true,
          error,
        },
      };
    });
  }, []);

  const setTouched = useCallback((name: string) => {
    setFields((prev) => {
      const field = prev[name];
      if (!field) return prev;

      // 触摸时校验
      let error: string | undefined;
      for (const validator of field.validators) {
        error = validator(field.value);
        if (error) break;
      }

      return {
        ...prev,
        [name]: { ...field, touched: true, error },
      };
    });
  }, []);

  const addValidator = useCallback((name: string, validator: (value: string) => string | undefined) => {
    setFields((prev) => {
      const field = prev[name];
      if (!field) return prev;
      return {
        ...prev,
        [name]: { ...field, validators: [...field.validators, validator] },
      };
    });
  }, []);

  const validateField = useCallback((name: string) => {
    const field = fields[name];
    if (!field) return true;

    for (const validator of field.validators) {
      const error = validator(field.value);
      if (error) {
        setFields((prev) => ({
          ...prev,
          [name]: { ...prev[name], error },
        }));
        return false;
      }
    }
    return true;
  }, [fields]);

  const validateAll = useCallback(() => {
    let allValid = true;
    const newFields = { ...fields };

    for (const [name, field] of Object.entries(fields)) {
      let error: string | undefined;
      for (const validator of field.validators) {
        error = validator(field.value);
        if (error) {
          allValid = false;
          break;
        }
      }
      newFields[name] = { ...field, touched: true, error };
    }

    setFields(newFields);
    return allValid;
  }, [fields]);

  const handleSubmit = useCallback(
    (onSubmit: (values: Record<string, string>) => void) => {
      return (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAll()) return;

        setIsSubmitting(true);
        const values: Record<string, string> = {};
        for (const [name, field] of Object.entries(fields)) {
          values[name] = field.value;
        }

        try {
          onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      };
    },
    [fields, validateAll]
  );

  const getFieldProps = useCallback(
    (name: string) => {
      const field = fields[name];
      return {
        value: field?.value || '',
        onChange: (value: string) => setValue(name, value),
        onBlur: () => setTouched(name),
        error: field?.touched ? field?.error : undefined,
      };
    },
    [fields, setValue, setTouched]
  );

  const isValid = Object.values(fields).every((f) => !f.error);

  return (
    <FormContext.Provider
      value={{
        state: { fields, isSubmitting, isValid },
        register,
        setValue,
        setTouched,
        addValidator,
        validateField,
        validateAll,
        handleSubmit,
        getFieldProps,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

// ============ Field 组件 ============
function Field({
  name,
  label,
  validate,
  children,
}: {
  name: string;
  label?: string;
  validate?: (value: string) => string | undefined;
  children: (props: {
    name: string;
    value: string;
    onChange: (v: string) => void;
    onBlur: () => void;
    error?: string;
  }) => React.ReactNode;
}) {
  const { register, addValidator, getFieldProps } = useForm();

  useState(() => {
    register(name, validate ? [validate] : []);
  });

  const props = getFieldProps(name);

  return (
    <div className="field">
      {label && <label htmlFor={name}>{label}</label>}
      {children(props)}
      {props.error && <span className="error">{props.error}</span>}
    </div>
  );
}

// ============ 使用 ============

function LoginForm() {
  return (
    <FormProvider initialValues={{ email: '', password: '' }}>
      <FormContent />
    </FormProvider>
  );
}

function FormContent() {
  const { handleSubmit, state } = useForm();

  return (
    <form onSubmit={handleSubmit((values) => console.log(values))}>
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
        {({ name, value, onChange, onBlur }) => (
          <input
            id={name}
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      </Field>

      <button type="submit" disabled={state.isSubmitting}>
        {state.isSubmitting ? 'Submitting...' : 'Login'}
      </button>
    </form>
  );
}
```
