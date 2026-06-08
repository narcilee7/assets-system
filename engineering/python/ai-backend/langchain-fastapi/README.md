# LangChain + FastAPI

LangChain 是 Python 最流行的 LLM 应用框架，与 FastAPI 结合可构建生产级 AI 服务。

## 核心实现

```python
# langchain_service.py
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
import os

# 初始化
llm = ChatOpenAI(model="gpt-4o", temperature=0)
embeddings = OpenAIEmbeddings()

# 向量存储
vectorstore = Chroma.from_documents(
    documents=documents,
    embedding=embeddings,
    persist_directory="./chroma_db",
)

# RAG Chain
prompt_template = """Use the following context to answer the question.
If you don't know, say you don't know.

Context: {context}
Question: {question}
Answer:"""

prompt = PromptTemplate(
    template=prompt_template,
    input_variables=["context", "question"],
)

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
    chain_type_kwargs={"prompt": prompt},
)

# FastAPI 集成
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class QueryRequest(BaseModel):
    question: str

@app.post("/chat")
async def chat(request: QueryRequest):
    result = qa_chain.invoke({"query": request.question})
    return {"answer": result["result"]}

# 流式输出
from fastapi.responses import StreamingResponse
from langchain.callbacks import AsyncIteratorCallbackHandler

@app.post("/chat/stream")
async def chat_stream(request: QueryRequest):
    callback = AsyncIteratorCallbackHandler()
    
    async def generate():
        task = asyncio.create_task(
            qa_chain.arun(request.question, callbacks=[callback])
        )
        async for token in callback.aiter():
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"
        await task
    
    return StreamingResponse(generate(), media_type="text/event-stream")

# Agent 工具链
from langchain.agents import create_openai_tools_agent, AgentExecutor
from langchain.tools import Tool

tools = [
    Tool(
        name="search_docs",
        func=vectorstore.similarity_search,
        description="Search documentation",
    ),
]

agent = create_openai_tools_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)
```
