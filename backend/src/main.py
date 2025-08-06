from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_chroma import Chroma
from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain.prompts import ChatPromptTemplate
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

load_dotenv()

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1,
    max_tokens=256
)

embedding = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
)


class QueryRequest(BaseModel):
    query: str


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or your frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_documents(path: str):
    """Load documents from the specified path."""
    try:
        loader = PyPDFLoader(path)
        documents = loader.load()
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading documents: {str(e)}")
    
def split_documents(documents, chunk_size=512, chunk_overlap=50):
    """Split documents into smaller chunks."""
    try:
        text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        return text_splitter.split_documents(documents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error splitting documents: {str(e)}")
    
def embed_documents(documents):
    """Embed documents and return a Chroma vectorstore."""
    try:
        vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=embedding,
        )
        return vectorstore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error embedding documents: {str(e)}")

def chain_doc(path: str):
    """Load, split, and embed documents from the specified path."""
    documents = load_documents(path)
    if not documents:
        raise HTTPException(status_code=404, detail="No documents found")
    
    split_docs = split_documents(documents)
    vectorstore = embed_documents(split_docs)
    
    # Create a retriever from the vectorstore
    retriever = vectorstore.as_retriever(search_kwargs={"k": 1})
    
    return retriever

retriever = chain_doc(r"C:\\Users\\HP\\Desktop\\voice-bot\\backend\\src\\Untitled.pdf")

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are now roleplaying as a character whose profile is given below. "
     "Respond to all questions as if you are that person. "
     "Speak naturally and in the first person with a human-like tone. "
     "Always stay in character and never refer to yourself as an AI. "
     "If you don't know the answer, respond in a believable way based on your personality."),
    ("system", "Context: {context}"),
    ("human", "{input}")
])


def generate_response(question: str):
    """Generate a response using the LLM."""
    context = retriever.invoke(question)[0].page_content if retriever.invoke(question) else ""
    
    prompt_with_context = prompt.format_messages(context=context, input=question)
    try:
        response = llm.invoke(prompt_with_context)
        return response.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating response: {str(e)}")


@app.post("/ask")
async def ask_question(request: QueryRequest):
    question = request.query
    if not question:
        raise HTTPException(status_code=400, detail="Question must be provided")

    try:
        answer = generate_response(question)
        return {"answer": answer if answer else "No answer found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
