import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import TransactionPlugin, {
  type Category,
} from '../plugins/transactionPlugin'
import { renderCategoryIcon } from '../icons'
import IconPicker from './IconPicker'

interface CategoryManagerProps {
  categories: Category[]
  onClose: () => void
  onCategoriesChanged: () => Promise<void>
}

const MAX_NAME_LENGTH = 40

export default function CategoryManager({
  categories,
  onClose,
  onCategoriesChanged,
}: CategoryManagerProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Tag')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] =
    useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleCreate = async () => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Enter a category name.')
      return
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      setError(
        `Category name must be ${MAX_NAME_LENGTH} characters or fewer.`,
      )
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await TransactionPlugin.addCategory({
        name: trimmedName,
        icon,
      })

      setName('')
      setIcon('Tag')
      setSuccess(`“${trimmedName}” was added.`)
      await onCategoriesChanged()
    } catch (err) {
      console.error('Category creation failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    setDeletingId(category.id)
    setError('')
    setSuccess('')

    try {
      await TransactionPlugin.deleteCategory({ id: category.id })
      setConfirmDeleteId(null)
      setSuccess(`“${category.name}” was deleted.`)
      await onCategoriesChanged()
    } catch (err) {
      console.error('Category deletion failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="transaction-modal category-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-manager-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="category-manager-title">Categories</h2>
            <p className="modal-subtitle">
              Create your own categories with a name and icon.
            </p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close categories"
          >
            <X size={19} />
          </button>
        </div>

        <div className="category-form">
          <h3>New category</h3>

          <label htmlFor="category-name">Name</label>
          <input
            id="category-name"
            type="text"
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Pets, Gifts, Fuel"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <label>Icon</label>
          <IconPicker value={icon} onChange={setIcon} />

          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}

          <div className="form-actions">
            <button
              className="cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>

            <button
              className="save-button"
              onClick={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving...' : 'Create category'}
            </button>
          </div>
        </div>

        <h3 className="category-list-title">
          Your categories ({categories.length})
        </h3>

        <div className="category-manage-list">
          {categories.map((category) => {
            return (
              <div
                className="category-manage-item"
                key={category.id}
              >
                <span className="category-manage-icon">
                  {renderCategoryIcon(category.icon, 18)}
                </span>

                <span className="category-manage-name">
                  {category.name}
                </span>

                {category.isDefault ? (
                  <span className="default-badge">Default</span>
                ) : confirmDeleteId === category.id ? (
                  <span className="delete-confirm">
                    <button
                      type="button"
                      className="confirm-delete-button"
                      onClick={() => handleDelete(category)}
                      disabled={deletingId !== null}
                    >
                      {deletingId === category.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>

                    <button
                      type="button"
                      className="cancel-delete-button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deletingId !== null}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="category-delete"
                    aria-label={`Delete ${category.name}`}
                    onClick={() =>
                      setConfirmDeleteId(category.id)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="category-note">
          Categories are stored only on this device. Deleting a
          category moves its transactions to “Other”.
        </p>
      </section>
    </div>
  )
}
