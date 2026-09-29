import { useDispatch, useSelector } from 'react-redux';
import { BlogPost, addToHashMap, updateInHashMap  } from '../state/features/blogSlice';
import { RootState } from '../state/store';

export const checkAndUpdatePost = (post: BlogPost) => {
  const dispatch = useDispatch();
  const hashMapPosts = useSelector((state: RootState) => state.blog.hashMapPosts);

  // Check if the post exists in hashMapPosts
  const existingPost = hashMapPosts[post.id];

  if (!existingPost) {
    // If the post doesn't exist, add it to hashMapPosts
    dispatch(addToHashMap(post))
  } else if (
    post?.updated &&
    existingPost?.updated &&
    (!existingPost.updated || post.updated) > existingPost.updated
  ) {
    // If the post exists and its updatedDate is more recent than the existing post's updatedDate, update it in hashMapPosts
    dispatch(updateInHashMap(post))
  }
}
