import React from 'react';
import { FolderPlus } from 'lucide-react';

interface EmptyWorkspaceProps {
  onCreate: () => void;
}

const EmptyWorkspace: React.FC<EmptyWorkspaceProps> = ({ onCreate }) => (
  <section className="empty-workspace">
    <FolderPlus size={34} aria-hidden="true" />
    <h2>建立一个研究会话</h2>
    <p>每个会话保存自己的论文、向量索引、综合综述与引用证据。</p>
    <button className="button button--primary" type="button" onClick={onCreate}><FolderPlus size={16} />新建研究会话</button>
  </section>
);

export default EmptyWorkspace;
