import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import {
  CriticalityBadge,
  ErrorNote,
  Loading,
  Modal,
  money,
  fmtDate,
  useLoad,
  useToast,
} from '../ui.jsx'

const TIER_ICONS = {
  site: '🏭',
  location: '📍',
  system: '⚙️',
  asset: '🛠️',
  component: '🔩',
}

const TIER_LABELS = {
  site: 'Site',
  location: 'Location',
  system: 'System',
  asset: 'Asset',
  component: 'Component',
}

function TreeNode({ node, level = 0, selectedId, onSelect, expandedIds, toggleExpand }) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id

  return (
    <div className="tree-node-wrapper" style={{ marginLeft: `${level * 18}px` }}>
      <div
        className={`tree-row ${isSelected ? 'tree-selected' : ''}`}
        onClick={() => onSelect(node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '4px',
          backgroundColor: isSelected ? 'var(--graphite)' : 'transparent',
          color: isSelected ? '#ffffff' : 'inherit',
          transition: 'background-color 0.15s ease',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleExpand(node.id)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: hasChildren ? 'pointer' : 'default',
            width: '24px',
            textAlign: 'center',
            visibility: hasChildren ? 'visible' : 'hidden',
            padding: 0,
            fontSize: '0.85rem',
          }}
        >
          {isExpanded ? '▼' : '▶'}
        </button>

        <span aria-hidden="true">{TIER_ICONS[node.tier] || '📦'}</span>

        <span style={{ fontWeight: level <= 1 ? 600 : 400, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>

        <span className="small muted" style={{ fontFamily: 'monospace', color: isSelected ? '#ffffffaa' : undefined }}>
          {node.code}
        </span>

        <span className="small" style={{ textTransform: 'capitalize', color: isSelected ? '#ffffffcc' : 'var(--ink-3)' }}>
          {TIER_LABELS[node.tier] || node.tier}
        </span>

        {node.criticality && <CriticalityBadge grade={node.criticality} />}
      </div>

      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Hierarchy() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: hierarchy, loading, error, reload } = useLoad(() => api.get('/api/hierarchy'))
  const [selectedNode, setSelectedNode] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCrit, setFilterCrit] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [nodeDetail, setNodeDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Fetch complete details whenever a node is selected
  const handleSelectNode = async (node) => {
    setSelectedNode(node)
    setLoadingDetail(true)
    try {
      const full = await api.get(`/api/assets/${node.id}`)
      setNodeDetail(full)
    } catch {
      setNodeDetail(node)
    } finally {
      setLoadingDetail(false)
    }
  }

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    const all = new Set()
    const walk = (nodes) => {
      for (const n of nodes) {
        all.add(n.id)
        if (n.children) walk(n.children)
      }
    }
    if (hierarchy) walk(hierarchy)
    setExpandedIds(all)
  }

  const collapseAll = () => setExpandedIds(new Set())

  // Recursive search filter
  const filterTree = (nodes) => {
    if (!searchTerm && !filterCrit) return nodes
    const term = searchTerm.toLowerCase()

    const matchNode = (n) => {
      const matchesSearch = !term || n.name.toLowerCase().includes(term) || n.code.toLowerCase().includes(term)
      const matchesCrit = !filterCrit || n.criticality === filterCrit
      const matchingChildren = n.children ? filterTree(n.children) : []
      if ((matchesSearch && matchesCrit) || matchingChildren.length > 0) {
        return { ...n, children: matchingChildren }
      }
      return null
    }

    return nodes.map(matchNode).filter(Boolean)
  }

  const filteredTree = hierarchy ? filterTree(hierarchy) : []

  return (
    <div className="stack" style={{ maxWidth: '100%' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Asset Hierarchy (ISO 55001)</h1>
          <p className="muted" style={{ margin: 0 }}>
            5-tier structured tree: Site → Location → System → Asset → Component.
          </p>
        </div>
        <div className="row">
          <button type="button" onClick={expandAll} className="small">Expand All</button>
          <button type="button" onClick={collapseAll} className="small">Collapse All</button>
          {can('asset.create') && (
            <button className="primary" onClick={() => setShowAddModal(true)}>
              + Add Hierarchy Node
            </button>
          )}
        </div>
      </div>

      <ErrorNote error={error} />

      {/* Filter toolbar */}
      <div className="panel row" style={{ padding: '12px', gap: '12px' }}>
        <input
          type="search"
          placeholder="Search by node name or code (e.g. AST-0001, Press, Plant A)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '220px' }}
        />
        <select value={filterCrit} onChange={(e) => setFilterCrit(e.target.value)} style={{ width: '180px' }}>
          <option value="">All Criticalities</option>
          <option value="A">Criticality A (High)</option>
          <option value="B">Criticality B (Medium)</option>
          <option value="C">Criticality C (Low)</option>
        </select>
      </div>

      {loading && <Loading />}

      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 420px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left column: Hierarchy tree */}
        <div className="panel" style={{ padding: '1rem', minHeight: '500px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tree View ({filteredTree.length} root branches)
            </span>
            <span className="small muted">Click any node to inspect details</span>
          </div>

          {filteredTree.length === 0 ? (
            <p className="muted" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              No hierarchy nodes match your filter criteria.
            </p>
          ) : (
            filteredTree.map((rootNode) => (
              <TreeNode
                key={rootNode.id}
                node={rootNode}
                level={0}
                selectedId={selectedNode?.id}
                onSelect={handleSelectNode}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
              />
            ))
          )}
        </div>

        {/* Right column: Selected node detail inspector */}
        {selectedNode && (
          <div className="panel stack" style={{ padding: '1.25rem', position: 'sticky', top: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedNode.tier} Details
                </span>
                <h2 style={{ margin: '4px 0' }}>{selectedNode.name}</h2>
                <span className="small muted" style={{ fontFamily: 'monospace' }}>{selectedNode.code}</span>
              </div>
              <button
                type="button"
                className="small"
                onClick={() => setSelectedNode(null)}
                style={{ padding: '4px 8px' }}
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="row" style={{ gap: '8px' }}>
              {selectedNode.criticality && <CriticalityBadge grade={selectedNode.criticality} />}
              <span className="badge grey" style={{ textTransform: 'capitalize' }}>Tier: {selectedNode.tier}</span>
              {nodeDetail?.category && <span className="badge blue">{nodeDetail.category}</span>}
              {nodeDetail?.under_warranty && <span className="badge green">Warranty Active</span>}
            </div>

            {loadingDetail ? (
              <Loading />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem', backgroundColor: 'var(--paper)', padding: '10px', borderRadius: '6px' }}>
                  <div>
                    <span className="muted small">Location</span>
                    <div style={{ fontWeight: 500 }}>{nodeDetail?.location || '—'}</div>
                  </div>
                  <div>
                    <span className="muted small">Cost Centre</span>
                    <div style={{ fontWeight: 500 }}>{nodeDetail?.cost_centre || '—'}</div>
                  </div>
                  <div>
                    <span className="muted small">Running Hours</span>
                    <div style={{ fontWeight: 500 }}>{nodeDetail?.running_hours != null ? `${nodeDetail.running_hours} h` : '—'}</div>
                  </div>
                  <div>
                    <span className="muted small">Replacement Value</span>
                    <div style={{ fontWeight: 500 }}>{money(nodeDetail?.replacement_value)}</div>
                  </div>
                  <div>
                    <span className="muted small">Installed Date</span>
                    <div style={{ fontWeight: 500 }}>{fmtDate(nodeDetail?.install_date) || '—'}</div>
                  </div>
                  <div>
                    <span className="muted small">Expected Life</span>
                    <div style={{ fontWeight: 500 }}>{nodeDetail?.expected_life_years ? `${nodeDetail.expected_life_years} yrs` : '—'}</div>
                  </div>
                </div>

                {/* Sub-components / Children summary */}
                {selectedNode.children && selectedNode.children.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Direct Sub-nodes ({selectedNode.children.length})</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                      {selectedNode.children.map((c) => (
                        <li key={c.id}>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              handleSelectNode(c)
                            }}
                          >
                            {c.name} ({c.code})
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bill of Materials (BOM) summary */}
                {nodeDetail?.bom && nodeDetail.bom.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Bill of Materials (BOM)</h3>
                    <div style={{ fontSize: '0.85rem' }}>
                      {nodeDetail.bom.map((b) => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                          <span>{b.name} ({b.sku})</span>
                          <span className="muted">{b.qty_recommended} {b.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Documents */}
                {nodeDetail?.documents && nodeDetail.documents.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Attached Documents</h3>
                    <div style={{ fontSize: '0.85rem' }}>
                      {nodeDetail.documents.map((d) => (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                          <span>📄 {d.title} (v{d.version})</span>
                          <span className="small muted">{d.doc_type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="row" style={{ marginTop: '8px' }}>
                  <Link to={`/assets/${selectedNode.id}`} className="btn small" style={{ flex: 1, textAlign: 'center' }}>
                    Open Full Asset Detail →
                  </Link>
                  <Link to={`/jobs/new?asset_id=${selectedNode.id}`} className="btn primary small" style={{ flex: 1, textAlign: 'center' }}>
                    + Raise Job
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddNodeModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false)
            reload()
            toast('Hierarchy node created successfully.', 'ok')
          }}
        />
      )}
    </div>
  )
}

function AddNodeModal({ onClose, onAdded }) {
  const [tier, setTier] = useState('component')
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [criticality, setCriticality] = useState('B')
  const [category, setCategory] = useState('')
  const [replacementValue, setReplacementValue] = useState('')
  const [expectedLifeYears, setExpectedLifeYears] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const { data: allAssets } = useLoad(() => api.get('/api/assets'))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      await api.post('/api/hierarchy/nodes', {
        name,
        tier,
        parent_id: parentId ? parseInt(parentId, 10) : null,
        criticality,
        category: category || undefined,
        replacement_value: replacementValue ? parseFloat(replacementValue) : 0,
        expected_life_years: expectedLifeYears ? parseInt(expectedLifeYears, 10) : 10,
      })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Asset Hierarchy Node" onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        <ErrorNote error={err} />
        <div>
          <label>Hierarchy Tier *</label>
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="site">Site (Plant / Campus)</option>
            <option value="location">Location (Building / Bay)</option>
            <option value="system">System (Production Line)</option>
            <option value="asset">Asset (Machine / Equipment)</option>
            <option value="component">Component (Sub-assembly / Part)</option>
          </select>
        </div>

        <div>
          <label>Node Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Spindle Assembly 24000 RPM, Plant A..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label>Parent Node</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">(None - Top Level)</option>
            {allAssets?.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.tier || 'asset'}] {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Criticality *</label>
            <select value={criticality} onChange={(e) => setCriticality(e.target.value)}>
              <option value="A">Criticality A (Production Critical)</option>
              <option value="B">Criticality B (Moderate Impact)</option>
              <option value="C">Criticality C (Low / Non-critical)</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Category</label>
            <input
              type="text"
              placeholder="e.g. Machine tools, Power..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Replacement Value (₹)</label>
            <input
              type="number"
              placeholder="0"
              value={replacementValue}
              onChange={(e) => setReplacementValue(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Expected Life (Years)</label>
            <input
              type="number"
              placeholder="10"
              value={expectedLifeYears}
              onChange={(e) => setExpectedLifeYears(e.target.value)}
            />
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create Node'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
