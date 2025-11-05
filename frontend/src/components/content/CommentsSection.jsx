import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Trash2, Edit2, Reply, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { setPostAuthIntent } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

// Prefer relative API by default; use VITE_API_URL only when explicitly configured
const API_URL = (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) || '';


function Comment({ comment, contentType, contentId, onReply, onDelete, onEdit, currentUserId, canModerate = false, preloadedLikes = {} }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.comment_text);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Initialize like state using any preloadedLikes (passed down when expanding replies)
  const initialLike = preloadedLikes && preloadedLikes[comment.id]
    ? preloadedLikes[comment.id]
    : { count: comment.like_count || 0, userHasLiked: comment.userHasLiked || false };
  const [likeState, setLikeState] = useState(initialLike);
  // If parent later provides preloaded info, update local state
  useEffect(() => {
    if (preloadedLikes && preloadedLikes[comment.id]) {
      setLikeState(preloadedLikes[comment.id]);
    }
  }, [preloadedLikes, comment.id]);
  const [likeLoading, setLikeLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCommentOwner = currentUserId && comment.user_id === currentUserId;
  const [showReplies, setShowReplies] = useState(false);
  const [repliesLikeCache, setRepliesLikeCache] = useState({});

  useEffect(() => {
    // Load like count and status for this comment
    loadCommentLike();
    // eslint-disable-next-line
  }, [comment.id]);

  const loadCommentLike = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/comment-likes/${comment.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLikeState(data);
      }
    } catch {}
  };

  const handleLike = async () => {
    if (!user) {
      setPostAuthIntent(window.location.pathname);
      navigate('/auth/login');
      return;
    }
    if (likeLoading) return;

    // Optimistic update: update UI immediately and revert on failure
    const prevState = { ...likeState };
    const optimistic = {
      userHasLiked: !prevState.userHasLiked,
      count: prevState.count + (prevState.userHasLiked ? -1 : 1),
    };

    setLikeState(optimistic);
    setLikeLoading(true);

    const method = prevState.userHasLiked ? 'DELETE' : 'POST';
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/comment-likes/${comment.id}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        // If server returns JSON (POST), prefer canonical state.
        // If server returns 204 / no-body (DELETE), don't wait for JSON — keep optimistic state.
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 204 || !contentType.includes('application/json')) {
          // Nothing to do, optimistic state already applied — quick return
          setLikeLoading(false);
          return;
        }

        // Server returned JSON — update state with canonical response
        try {
          const data = await res.json();
          setLikeState(data);
        } catch (err) {
          // If parsing fails, keep optimistic state
          console.warn('Failed to parse like response, keeping optimistic state', err);
        }
      } else {
        // Revert optimistic update on failure
        setLikeState(prevState);
        // Optionally notify user
        try {
          const err = await res.json();
          alert(err.error || 'Failed to update like.');
        } catch {
          alert('Failed to update like.');
        }
      }
    } catch (error) {
      // Network or other error: revert optimistic state
      console.error('Failed to update comment like:', error);
      setLikeState(prevState);
      alert('Network error. Please try again.');
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setIsSaving(true);
    const success = await onEdit(comment.id, editText);
    setIsSaving(false);
    if (success) setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(comment.id);
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  const rawProfile = comment.profile_image || comment.profile_image_path || '';
  const profileImage = rawProfile
    ? (rawProfile.startsWith('http') ? rawProfile : `${API_URL}${rawProfile}`)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || 'User')}&background=random`;

  return (
    <div className="flex gap-2 sm:gap-3 mb-4 items-start">
      <img
        src={profileImage}
        alt={comment.username}
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0 border-2 border-white shadow"
        onError={(e) => {
          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.username || 'User')}&background=random`;
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
          <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
            <span className="font-semibold text-sm text-gray-900 truncate max-w-[60%] sm:max-w-none">{comment.username || 'Anonymous'}</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          {isEditing ? (
            <div className="mt-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[80px]"
                disabled={isSaving}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editText.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="!bg-gray-200 !text-gray-800 hover:!bg-gray-300 border border-gray-300"
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(comment.comment_text);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.comment_text}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 ml-1">
          <button
            onClick={handleLike}
            className={`text-xs flex items-center gap-1 font-medium transition-all ${likeState.userHasLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'}`}
            disabled={likeLoading}
            aria-label={likeState.userHasLiked ? 'Unlike comment' : 'Like comment'}
          >
            <Heart className={`w-3 h-3 ${likeState.userHasLiked ? 'fill-red-500' : 'fill-none'}`} />
            {likeState.count}
          </button>
          <button
            onClick={() => onReply(comment)}
            className="text-xs text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1"
          >
            <Reply className="w-3 h-3" />
            Reply
          </button>
          {!isEditing && (
            <>
              {isCommentOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-600 hover:text-blue-600 font-medium flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              )}
              {(isCommentOwner || canModerate) && (
                <>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting}
                    className="text-xs text-gray-600 hover:text-red-600 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <ConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDelete}
                    title="Delete Comment"
                    description="Are you sure you want to delete this comment? This action cannot be undone."
                    confirmText="Delete"
                    cancelText="Cancel"
                  />
                </>
              )}
            </>
          )}
        </div>
        {/* Nested Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            <button
              onClick={async () => {
                const willShow = !showReplies;
                setShowReplies(willShow);
                if (willShow) {
                  // prefill cache from available reply metadata so likes show instantly
                  const initial = {};
                  comment.replies.forEach(r => {
                    initial[r.id] = { count: r.like_count || 0, userHasLiked: r.userHasLiked || false };
                  });
                  setRepliesLikeCache(initial);

                  // fetch fresh like state for each reply in parallel (non-blocking)
                  try {
                    const ids = comment.replies.map(r => r.id);
                    const promises = ids.map(id => fetch(`${API_URL}/api/comment-likes/${id}`).then(res => res.ok ? res.json() : null).catch(() => null));
                    const results = await Promise.all(promises);
                    const updated = { ...initial };
                    results.forEach((res, idx) => {
                      if (res) updated[ids[idx]] = res;
                    });
                    setRepliesLikeCache(updated);
                  } catch (e) {
                    // ignore network errors — we already showed initial counts
                  }
                }
              }}
              className="text-xs text-gray-600 hover:text-blue-600 font-medium mb-2"
            >
              {showReplies ? `Hide replies (${comment.replies.length})` : `Show replies (${comment.replies.length})`}
            </button>

            {showReplies && (
              <div className="mt-1 ml-3 pl-3 sm:ml-4 sm:pl-4 border-l-2 border-gray-200">
                {comment.replies.map((reply) => (
                  <Comment
                    key={reply.id}
                    comment={reply}
                    contentType={contentType}
                    contentId={contentId}
                    onReply={onReply}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    preloadedLikes={repliesLikeCache}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentsSection({ contentType, contentId, className = '', canModerate = false }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Unique id for the new comment input so we can focus/scroll to it when replying
  const commentInputId = `comment-input-${contentType}-${contentId}`;

  // Handler passed to child comments: sets reply target and focuses the input
  const handleReplyClick = (comment) => {
    // ensure comments visible
    if (!showComments) setShowComments(true);
    setReplyingTo(comment);

    // Retry-focused approach: attempt to find and focus the input several times
    let attempts = 0;
    const tryFocus = () => {
      attempts += 1;
      // Try ID first, then fallback to a textarea inside that id (in case Textarea wraps)
      let el = document.getElementById(commentInputId);
      if (!el) {
        const wrapper = document.getElementById(commentInputId);
        if (wrapper) el = wrapper.querySelector('textarea') || wrapper.querySelector('input');
      }
      if (!el) {
        // fallback: search for any textarea inside the comments section
        const maybe = document.querySelector(`#comment-input-${contentType}-${contentId}`) || document.querySelector(`textarea[id^=comment-input-]`);
        if (maybe) el = maybe;
      }

      if (el) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
        try {
          el.focus();
          if (typeof el.selectionStart === 'number') {
            el.selectionStart = el.selectionEnd = el.value.length;
          }
        } catch (e) {}
        return;
      }

      if (attempts < 8) {
        // try again after a short delay — helps on slow mobile where keyboard/layout takes time
        setTimeout(tryFocus, 100);
      }
    };

    // Kick off first attempt on next microtask so DOM updates settle
    setTimeout(tryFocus, 40);
  };

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [contentType, contentId, showComments]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/comments/${contentType}/${contentId}`
      );

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      setPostAuthIntent(window.location.pathname);
      navigate('/auth/login');
      return;
    }

    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/comments/${contentType}/${contentId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comment_text: newComment,
            parent_id: replyingTo?.id || null,
          }),
        }
      );

      if (response.ok) {
        const newCommentData = await response.json();
        
        if (replyingTo) {
          // Add reply to parent comment
          setComments(prevComments => 
            addReplyToComment(prevComments, replyingTo.id, newCommentData)
          );
        } else {
          // Add new root comment
          setComments(prev => [...prev, newCommentData]);
        }
        
        setNewComment('');
        setReplyingTo(null);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        setPostAuthIntent(window.location.pathname);
        navigate('/auth/login');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId, newText) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment_text: newText }),
        }
      );

      if (response.ok) {
        const updatedComment = await response.json();
        setComments(prevComments => 
          updateCommentInTree(prevComments, commentId, updatedComment)
        );
        return true;
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to edit comment');
        return false;
      }
    } catch (error) {
      console.error('Failed to edit comment:', error);
      alert('Failed to edit comment. Please try again.');
      return false;
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/comments/${commentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setComments(prevComments => 
          removeCommentFromTree(prevComments, commentId)
        );
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  // Helper functions to manipulate comment tree
  const addReplyToComment = (comments, parentId, reply) => {
    return comments.map(comment => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), reply]
        };
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: addReplyToComment(comment.replies, parentId, reply)
        };
      }
      return comment;
    });
  };

  const updateCommentInTree = (comments, commentId, updatedData) => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return { ...comment, ...updatedData };
      } else if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentInTree(comment.replies, commentId, updatedData)
        };
      }
      return comment;
    });
  };

  const removeCommentFromTree = (comments, commentId) => {
    return comments
      .filter(comment => comment.id !== commentId)
      .map(comment => {
        if (comment.replies && comment.replies.length > 0) {
          return {
            ...comment,
            replies: removeCommentFromTree(comment.replies, commentId)
          };
        }
        return comment;
      });
  };

  const totalComments = comments.reduce((acc, comment) => {
    return acc + 1 + (comment.replies?.length || 0);
  }, 0);

  return (
    <div className={`bg-white rounded-lg ${className}`}>
      {/* Header */}
      <button
        onClick={() => setShowComments(!showComments)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-900">
            Comments {totalComments > 0 && `(${totalComments})`}
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {showComments ? 'Hide' : 'Show'}
        </span>
      </button>

      {/* Comments Section */}
      {showComments && (
        <div className="p-3 sm:p-4 pt-0">
          {/* New Comment Input */}
          <div className="mb-6">
            {replyingTo && (
              <div className="flex items-center justify-between bg-blue-50 p-2 rounded mb-2">
                <span className="text-sm text-blue-700">
                  Replying to <strong>{replyingTo.username}</strong>
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-blue-700 hover:text-blue-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="flex gap-2">
              <Textarea
                id={commentInputId}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                className="flex-1 min-h-[80px]"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex justify-end mt-2">
              <Button
                onClick={handleSubmitComment}
                disabled={isSubmitting || !newComment.trim()}
                size="sm"
              >
                <Send className="w-4 h-4 mr-1" />
                {isSubmitting ? 'Posting...' : replyingTo ? 'Reply' : 'Comment'}
              </Button>
            </div>
          </div>

          {/* Comments List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div>
              {comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  contentType={contentType}
                  contentId={contentId}
                  onReply={handleReplyClick}
                  onDelete={handleDeleteComment}
                  onEdit={handleEditComment}
                  currentUserId={user?.id}
                  canModerate={!!canModerate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
