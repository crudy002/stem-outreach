import { useState } from 'react';
import { useTheme } from '../theme.jsx';

export function FileBrowserSidebar({ tree, onSelectFile }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.bgDeep, border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '14px', height: '480px', overflowY: 'auto' }}>
      <div style={{ fontSize: '11px', color: theme.muted, letterSpacing: '0.2em', marginBottom: '12px' }}>FILES</div>
      {Object.values(tree.children).map((node) => (
        <TreeNode key={node.path} node={node} depth={0} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, onSelectFile }) {
  const { theme } = useTheme();
  // Folders start collapsed — opening them is the puzzle, so don't hand
  // kids the answer by pre-expanding the tree.
  const [open, setOpen] = useState(false);
  const indent = 10 + depth * 14;

  if (node.type === 'file') {
    return (
      <div
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: indent, paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', color: theme.text2, cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.color = theme.accent}
        onMouseLeave={(e) => e.currentTarget.style.color = theme.text2}
      >
        📄 {node.name}
      </div>
    );
  }

  const children = Object.values(node.children);
  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ paddingLeft: indent, paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', color: theme.accent, cursor: 'pointer' }}
      >
        {open ? '📂' : '📁'} {node.name}
      </div>
      {open && children.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}
