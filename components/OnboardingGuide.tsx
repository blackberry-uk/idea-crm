
import React from 'react';
import { useStore } from '../store/useStore';
import { CheckCircle2, Circle, Lightbulb, MessageSquare, Users, ClipboardList, UserPlus, Clock, Brain } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OnboardingGuideProps {
    hideIfCompleted?: boolean;
}

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ hideIfCompleted }) => {
    const { data } = useStore();
    const hasIdea = data.ideas.length > 0;

    const tasks = [
        {
            id: 'create-idea',
            title: 'Create your first idea',
            description: 'Start by capturing a new project or venture.',
            icon: Lightbulb,
            completed: hasIdea,
            link: '/ideas',
            requiresIdea: false
        },
        {
            id: 'add-note',
            title: 'Add an insight or note',
            description: 'Capture thoughts, reflections, or data points.',
            icon: MessageSquare,
            completed: data.notes.length > 0,
            link: hasIdea ? `/ideas/${data.ideas[0].id}` : '/ideas',
            requiresIdea: true
        },
        {
            id: 'add-contact',
            title: 'Add a contact',
            description: 'Build your network of collaborators and leads.',
            icon: UserPlus,
            completed: data.contacts.length > 0,
            link: '/contacts',
            requiresIdea: false
        },
        {
            id: 'add-todo',
            title: 'Add a to-do',
            description: 'Break down your idea into actionable steps.',
            icon: ClipboardList,
            completed: data.ideas.some(i => i.todos.length > 0),
            link: hasIdea ? `/ideas/${data.ideas[0].id}` : '/ideas',
            requiresIdea: true
        },
        {
            id: 'invite-people',
            title: 'Invite a collaborator',
            description: 'Share your idea and work together.',
            icon: Users,
            completed: data.invitations.length > 0,
            link: hasIdea ? `/ideas/${data.ideas[0].id}` : '/ideas',
            requiresIdea: true
        },
        {
            id: 'add-meeting-minute',
            title: 'Record meeting minutes',
            description: 'Use the structured template for agreements and decisions.',
            icon: Clock,
            completed: data.notes.some(n => {
                try {
                    const structured = JSON.parse(n.body);
                    return structured.template === 'call-minute';
                } catch (e) {
                    return false;
                }
            }),
            link: hasIdea ? `/ideas/${data.ideas[0].id}` : '/ideas',
            requiresIdea: true
        }
    ];

    const completedCount = tasks.filter(t => t.completed).length;
    const isCompleted = completedCount === tasks.length && tasks.length > 0;
    const progress = Math.round((completedCount / tasks.length) * 100);

    if (hideIfCompleted && isCompleted) {
        return null;
    }

    return (
        <div className="bg-white rounded-[2.5rem] border border-[var(--border)] shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-700">
            <div className="p-10 border-b border-[var(--border)] bg-gradient-to-br from-indigo-50/50 via-violet-50/30 to-transparent relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Brain className="w-32 h-32" />
                </div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Training Mode</span>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-1 font-sans">Getting Started</h2>
                        <p className="text-sm font-medium text-gray-500">A quick guide to mastering your new innovation workspace.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 leading-none mb-1">{progress}%</div>
                        <div className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Mastery Level</div>
                    </div>
                </div>

                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200/50 p-1">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => {
                    const isLocked = task.requiresIdea && !hasIdea;
                    const Component = isLocked ? 'div' : Link;

                    return (
                        <Component
                            key={task.id}
                            to={isLocked ? undefined : task.link}
                            className={`flex items-start gap-4 p-5 rounded-[2rem] transition-all border group relative
                ${task.completed
                                    ? 'bg-gray-50/50 border-gray-100 opacity-60 grayscale-[0.5]'
                                    : isLocked
                                        ? 'bg-gray-100/50 border-gray-100 cursor-not-allowed opacity-50'
                                        : 'bg-white border-transparent hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1'
                                }`}
                        >
                            <div className={`p-4 rounded-2xl shrink-0 transition-transform duration-500 ${!isLocked && 'group-hover:scale-110'} shadow-sm
                ${task.completed
                                    ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                                    : isLocked
                                        ? 'bg-gray-200 text-gray-400'
                                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                }`}
                            >
                                {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <task.icon className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className={`text-sm font-black tracking-tight ${task.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                        {task.title}
                                    </h3>
                                    {isLocked && <div className="p-1 bg-gray-200 rounded-lg"><Clock className="w-3 h-3 text-gray-400" /></div>}
                                </div>
                                <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2">
                                    {isLocked ? 'Please create an idea first to unlock this step.' : task.description}
                                </p>
                            </div>
                        </Component>
                    );
                })}
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Progress Tracking</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    {completedCount} of {tasks.length} milestones achieved
                </p>
            </div>
        </div>
    );
};

export default OnboardingGuide;
