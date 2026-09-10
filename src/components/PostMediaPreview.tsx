import React from 'react';
import type { CommunityPost } from '../types';
import { FeedMediaPreview } from './FeedMediaPreview';
interface Props { post: Pick<CommunityPost,'coverImage'|'coverImageAlt'|'mediaUrls'|'title'>; showAll?: boolean; className?: string; }
export const PostMediaPreview:React.FC<Props>=({post,showAll=false,className=''})=><FeedMediaPreview item={post} showAll={showAll} className={className}/>;
