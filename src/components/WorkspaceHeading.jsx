import { VIEW_TITLES } from './workspaceTitles.js';
const DESCRIPTIONS = {
    input: '把遇见的词，变成自己的词。', list: '每一个词，都有你的学习轨迹。',
    frequency: '看看哪些词，一次又一次与你相遇。', date: '沿着时间，回看你的积累。',
    article: '从真实的阅读中，积累值得记住的表达。', writing: '写得更自然，也把好表达留下来。'
};
export default function WorkspaceHeading({ view }) {
    return <div className="workspace-heading"><h1>{VIEW_TITLES[view]}</h1><p>{DESCRIPTIONS[view]}</p></div>;
}
