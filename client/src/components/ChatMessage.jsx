import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./Icons.jsx";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  async function onClick() {
    if (await copyText(text)) {
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }
  }
  return (
    <button type="button" className="copy-btn" onClick={onClick} aria-label={label}>
      <Icon name={done ? "check" : "copy"} size={14} />
      <span>{done ? "Copied" : label}</span>
    </button>
  );
}

function CodeBlock({ children }) {
  const codeEl = Array.isArray(children) ? children[0] : children;
  const raw = codeEl?.props?.children;
  const text = (Array.isArray(raw) ? raw.join("") : String(raw ?? "")).replace(/\n$/, "");
  const lang = /language-([\w-]+)/.exec(codeEl?.props?.className || "")?.[1] || "code";
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{lang}</span>
        <CopyButton text={text} />
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  );
}

const mdComponents = {
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node, ...props }) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  )
};

export default function ChatMessage({ message }) {
  if (message.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="bubble">{message.content}</div>
      </div>
    );
  }
  return (
    <div className="msg msg-ai">
      <div className="avatar" aria-hidden="true">
        <Icon name="spark" size={16} />
      </div>
      <div className="ai-body">
        <div className="ai-name">Signal AI</div>
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
        <div className="msg-actions">
          <CopyButton text={message.content} label="Copy answer" />
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="msg msg-ai" role="status" aria-live="polite">
      <div className="avatar pulse" aria-hidden="true">
        <Icon name="spark" size={16} />
      </div>
      <div className="ai-body">
        <div className="ai-name">Signal AI</div>
        <div className="typing" aria-label="Signal AI is thinking">
          <i /> <i /> <i />
        </div>
      </div>
    </div>
  );
}
