import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './MarkdownView.css';

/**
 * Markdown本文を、$...$ / $$...$$ のKaTeX数式に対応させつつHTML化する。
 * 数式はmarkedにかける前に一旦プレースホルダへ退避させる
 * (アンダースコア等をMarkdownの強調記法と誤認されないようにするため)。
 */
function renderMarkdownWithMath(source: string): string {
  const blocks: string[] = [];
  const placeholder = (i: number) => `@@KATEX_BLOCK_${i}@@`;

  let text = source.replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr: string) => {
    const html = katex.renderToString(expr.trim(), { throwOnError: false, displayMode: true });
    blocks.push(html);
    return placeholder(blocks.length - 1);
  });

  text = text.replace(/(^|[^\\])\$([^\n$]+?)\$/g, (_match, pre: string, expr: string) => {
    const html = katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false });
    blocks.push(html);
    return pre + placeholder(blocks.length - 1);
  });

  let html = marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
  html = html.replace(/@@KATEX_BLOCK_(\d+)@@/g, (_match, i: string) => blocks[Number(i)] ?? '');

  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup',
      'mfrac', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mspace', 'mtext', 'annotation',
    ],
    ADD_ATTR: ['xmlns', 'mathvariant', 'encoding'],
  });
}

interface MarkdownViewProps {
  source: string;
  className?: string;
}

export function MarkdownView({ source, className }: MarkdownViewProps) {
  const html = useMemo(() => renderMarkdownWithMath(source), [source]);
  return <div className={`markdown-view ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
