import React, { useState, useCallback } from 'react';
import type { MockComment, MockUser } from './mock-data';
import { MOCK_USERS } from './mock-data';
import { Button } from '@/components/ui';

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getUserName(authorId: string): string {
  return (
    MOCK_USERS.find((u: MockUser) => u.id === authorId)?.displayName ??
    'Anonymous'
  );
}

// ── Single Comment ────────────────────────────────────────────────────────

interface CommentProps {
  comment: MockComment;
  replies: MockComment[];
  allComments: MockComment[];
  depth: number;
  onAddReply: (parentId: string, body: string) => void;
}

function Comment({
  comment,
  replies,
  allComments,
  depth,
  onAddReply,
}: CommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [localUpvotes, setLocalUpvotes] = useState(0);
  const [hasUpvoted, setHasUpvoted] = useState(false);

  const handleUpvote = useCallback(() => {
    if (hasUpvoted) {
      setLocalUpvotes((v) => v - 1);
      setHasUpvoted(false);
    } else {
      setLocalUpvotes((v) => v + 1);
      setHasUpvoted(true);
    }
  }, [hasUpvoted]);

  const handleSubmitReply = useCallback(() => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    onAddReply(comment.id, trimmed);
    setReplyText('');
    setShowReplyForm(false);
  }, [replyText, comment.id, onAddReply]);

  const maxDepth = 3;

  return (
    <div
      className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-200' : ''}`}
    >
      <div className="py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {getUserName(comment.authorId)}
          </span>
          <span className="text-xs text-gray-400">
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-700 leading-relaxed mb-2">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUpvote}
            aria-label="Upvote comment"
            aria-pressed={hasUpvoted}
            className={`flex items-center gap-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-0.5 ${
              hasUpvoted
                ? 'text-green-600'
                : 'text-gray-400 hover:text-green-600'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={hasUpvoted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span className="tabular-nums">
              {comment.upvotes + localUpvotes}
            </span>
          </button>

          {depth < maxDepth && (
            <button
              type="button"
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-0.5"
            >
              Reply
            </button>
          )}
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSubmitReply}>
                Reply
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowReplyForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Nested Replies */}
      {replies.map((reply) => {
        const childReplies = allComments.filter(
          (c) => c.parentId === reply.id,
        );
        return (
          <Comment
            key={reply.id}
            comment={reply}
            replies={childReplies}
            allComments={allComments}
            depth={depth + 1}
            onAddReply={onAddReply}
          />
        );
      })}
    </div>
  );
}

// ── Comment Thread ────────────────────────────────────────────────────────

interface CommentThreadProps {
  hotspotId: string;
  comments: MockComment[];
}

export function CommentThread({ hotspotId, comments }: CommentThreadProps) {
  const [localComments, setLocalComments] = useState<MockComment[]>(comments);
  const [newCommentText, setNewCommentText] = useState('');

  const handleAddComment = useCallback(() => {
    const trimmed = newCommentText.trim();
    if (!trimmed) return;

    const newComment: MockComment = {
      id: `c-local-${Date.now()}`,
      hotspotId,
      parentId: null,
      authorId: 'u1', // mock current user
      body: trimmed,
      upvotes: 0,
      createdAt: Date.now(),
    };

    setLocalComments((prev) => [...prev, newComment]);
    setNewCommentText('');
  }, [newCommentText, hotspotId]);

  const handleAddReply = useCallback(
    (parentId: string, body: string) => {
      const reply: MockComment = {
        id: `c-local-${Date.now()}`,
        hotspotId,
        parentId,
        authorId: 'u1',
        body,
        upvotes: 0,
        createdAt: Date.now(),
      };
      setLocalComments((prev) => [...prev, reply]);
    },
    [hotspotId],
  );

  // Build top-level comments
  const topLevel = localComments.filter((c) => c.parentId === null);
  const commentCount = localComments.length;

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Comments ({commentCount})
      </h3>

      {/* New comment form */}
      <div className="mb-6">
        <textarea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
        />
        <div className="mt-2">
          <Button variant="primary" onClick={handleAddComment}>
            Post Comment
          </Button>
        </div>
      </div>

      {/* Comment list */}
      <div className="divide-y divide-gray-100">
        {topLevel.map((comment) => {
          const replies = localComments.filter(
            (c) => c.parentId === comment.id,
          );
          return (
            <Comment
              key={comment.id}
              comment={comment}
              replies={replies}
              allComments={localComments}
              depth={0}
              onAddReply={handleAddReply}
            />
          );
        })}
      </div>

      {topLevel.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No comments yet. Be the first to share your thoughts.
        </p>
      )}
    </div>
  );
}
