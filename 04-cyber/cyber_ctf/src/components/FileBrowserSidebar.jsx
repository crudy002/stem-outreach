import { useState } from 'react';

export function FileBrowserSidebar({ tree, onSelectFile }) {
  return (
    <div style={{ background: '#081320', border: '1px solid #1f3354', borderRadius: '4px', padding: '14px', height: '480px', overflowY: 'auto' }}>
      <div style={{ fontSize: '11px', color: '#5a7090', letterSpacing: '0.2em', marginBottom: '12px' }}>FILES</div>
      {Object.values(tree.children).map((node) => (
        <TreeNode key={node.path} node={node} depth={0} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, onSelectFile }) {
  // Folders start collapsed — opening them is the puzzle, so don't hand
  // kids the answer by pre-expanding the tree.
  const [open, setOpen] = useState(false);
  const indent = 10 + depth * 14;

  if (node.type === 'file') {
    return (
      <div
        onClick={() => onSelectFile(node.path)}
        style={{ paddingLeft: indent, paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', color: '#8da3c0', cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#5b9bd5'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#8da3c0'}
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
        style={{ paddingLeft: indent, paddingTop: '4px', paddingBottom: '4px', fontSize: '12px', color: '#5b9bd5', cursor: 'pointer' }}
      >
        {open ? '📂' : '📁'} {node.name}
      </div>
      {open && children.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}
