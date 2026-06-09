# 生成式 UI

## 1. 结构化输出驱动 UI

```typescript
// AI 返回结构化数据，前端映射为组件

// 1. 定义组件 Schema
const weatherCardSchema = z.object({
  type: z.literal('weather-card'),
  props: z.object({
    city: z.string(),
    temperature: z.number(),
    condition: z.enum(['sunny', 'cloudy', 'rainy', 'snowy']),
    humidity: z.number(),
    forecast: z.array(z.object({
      day: z.string(),
      high: z.number(),
      low: z.number(),
      condition: z.string(),
    })),
  }),
});

const chartSchema = z.object({
  type: z.literal('chart'),
  props: z.object({
    chartType: z.enum(['line', 'bar', 'pie']),
    data: z.array(z.object({
      label: z.string(),
      value: z.number(),
    })),
    title: z.string(),
  }),
});

const uiSchema = z.discriminatedUnion('type', [
  weatherCardSchema,
  chartSchema,
  // ... 更多组件
]);

// 2. AI 生成组件数据
async function generateUI(prompt: string) {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: uiSchema,
    system: `你是一个 UI 生成助手。根据用户请求生成对应的组件数据。
可用的组件类型：weather-card, chart, table, timeline, code-block。
始终返回有效的 JSON，匹配提供的 schema。`,
    prompt,
  });

  return object;
}

// 3. 组件映射表
const componentMap: Record<string, React.ComponentType<any>> = {
  'weather-card': WeatherCard,
  'chart': Chart,
  'table': DataTable,
  'timeline': Timeline,
  'code-block': CodeBlock,
};

// 4. 动态渲染
function GenerativeUI({ data }: { data: z.infer<typeof uiSchema> }) {
  const Component = componentMap[data.type];
  if (!Component) return <div>Unknown component: {data.type}</div>;

  return <Component {...data.props} />;
}
```

```tsx
// WeatherCard 组件
function WeatherCard({ city, temperature, condition, humidity, forecast }) {
  const icons = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    snowy: '❄️',
  };

  return (
    <div className="weather-card">
      <div className="current">
        <span className="icon">{icons[condition]}</span>
        <span className="temp">{temperature}°C</span>
        <span className="city">{city}</span>
        <span className="humidity">湿度 {humidity}%</span>
      </div>
      <div className="forecast">
        {forecast.map((day) => (
          <div key={day.day} className="forecast-day">
            <span>{day.day}</span>
            <span>{day.high}° / {day.low}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 2. React Server Components + AI

```tsx
// app/ai-components/Weather.tsx
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Server Component：在服务端调用 AI
export async function AIWeatherCard({ query }: { query: string }) {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: z.object({
      city: z.string(),
      temperature: z.number(),
      condition: z.string(),
    }),
    system: '提取或推断用户查询中的天气信息',
    prompt: query,
  });

  return (
    <div className="ai-weather-card">
      <h3>{object.city}</h3>
      <p>{object.temperature}°C - {object.condition}</p>
    </div>
  );
}

// 使用
// page.tsx
import { AIWeatherCard } from './ai-components/Weather';

export default function Page() {
  return (
    <div>
      <h1>AI 天气助手</h1>
      <AIWeatherCard query="北京今天天气怎么样？" />
    </div>
  );
}
```

## 3. AI 生成表单

```typescript
// AI 根据自然语言生成表单配置
const formSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'number', 'select', 'textarea', 'date', 'checkbox']),
    required: z.boolean().optional(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    placeholder: z.string().optional(),
    validation: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
  })),
});

async function generateForm(description: string) {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: formSchema,
    system: '根据描述生成表单配置。字段名使用英文，标签使用中文。',
    prompt: description,
  });

  return object;
}

// 动态表单渲染
function AIGeneratedForm({ config }: { config: z.infer<typeof formSchema> }) {
  return (
    <form className="ai-form">
      {config.title && <h2>{config.title}</h2>}
      {config.description && <p>{config.description}</p>}

      {config.fields.map((field) => (
        <div key={field.name} className="field">
          <label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>

          {field.type === 'select' ? (
            <select id={field.name} name={field.name} required={field.required}>
              <option value="">请选择</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
            />
          ) : (
            <input
              type={field.type}
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              min={field.validation?.min}
              max={field.validation?.max}
              pattern={field.validation?.pattern}
            />
          )}
        </div>
      ))}

      <button type="submit">提交</button>
    </form>
  );
}
```

## 4. 多模态生成 UI

```typescript
// 图片理解 + UI 生成
async function analyzeImageAndGenerateUI(imageBase64: string) {
  const result = await generateObject({
    model: openai('gpt-4o-vision'),
    schema: z.object({
      description: z.string(),
      uiComponents: z.array(z.object({
        type: z.string(),
        props: z.record(z.unknown()),
      })),
    }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '分析这张图片并生成对应的 UI 组件配置' },
          { type: 'image', image: imageBase64 },
        ],
      },
    ],
  });

  return result.object;
}

// 前端直接处理图片输入
function ImageUploadChat() {
  const [image, setImage] = useState<string | null>(null);

  const handleImageUpload = async (file: File) => {
    const base64 = await fileToBase64(file);
    setImage(base64);

    const ui = await analyzeImageAndGenerateUI(base64);
    renderUI(ui);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
      />
      {image && <img src={image} alt="Uploaded" className="preview" />}
    </div>
  );
}
```
