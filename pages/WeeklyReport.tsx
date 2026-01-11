
import React from 'react';
import { useStore } from '../store/useStore';
import { format, startOfWeek, endOfWeek, isWithinInterval, subDays } from 'date-fns';
import { Printer, TrendingUp, MessageSquare, ListTodo, Download } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const WeeklyReport: React.FC = () => {
  const { data } = useStore();
  
  const today = new Date();
  const start = startOfWeek(today);
  const end = endOfWeek(today);

  // Ideas moved status this week
  const updatedThisWeek = data.ideas.filter(i => 
    isWithinInterval(new Date(i.updatedAt), { start, end })
  );

  // Notes added this week
  const notesThisWeek = data.notes.filter(n => 
    isWithinInterval(new Date(n.createdAt), { start, end })
  );

  // Interactions completed this week
  const interactionsThisWeek = data.interactions.filter(int => 
    isWithinInterval(new Date(int.date), { start, end })
  );

  // Upcoming actions
  const upcomingActions = data.interactions.filter(int => 
    int.nextActionDate && isWithinInterval(new Date(int.nextActionDate), { start, end: subDays(end, -7) })
  );

  // Data for chart: Notes count by idea (this week)
  const chartData = data.ideas.map(idea => ({
    name: idea.title.length > 15 ? idea.title.substring(0, 12) + '...' : idea.title,
    count: data.notes.filter(n => n.ideaId === idea.id && isWithinInterval(new Date(n.createdAt), { start, end })).length
  })).filter(d => d.count > 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 print:p-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-200 pb-8 print:border-0">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Weekly Summary</h1>
          <p className="text-gray-500 font-medium">
            {format(start, 'MMMM d')} — {format(end, 'MMMM d, yyyy')}
          </p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 print:hidden"
        >
          <Printer className="w-5 h-5" />
          Print / Export PDF
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Status Moves</p>
            <p className="text-3xl font-black text-gray-900">{updatedThisWeek.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-green-50 rounded-2xl text-green-600">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">New Notes</p>
            <p className="text-3xl font-black text-gray-900">{notesThisWeek.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-orange-50 rounded-2xl text-orange-600">
            <ListTodo className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Interactions</p>
            <p className="text-3xl font-black text-gray-900">{interactionsThisWeek.length}</p>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm print:shadow-none">
          <h2 className="text-xl font-bold mb-6">Idea Activity (New Notes)</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'][index % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Ideas Updated
          </h2>
          <div className="space-y-3">
            {updatedThisWeek.length > 0 ? updatedThisWeek.map(idea => (
              <div key={idea.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="font-bold text-gray-900">{idea.title}</p>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] font-bold uppercase text-gray-400">Current Status:</span>
                   <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100">{idea.status}</span>
                </div>
              </div>
            )) : <p className="text-sm text-gray-400 italic">No status changes this week.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-orange-600" />
            Upcoming Actions
          </h2>
          <div className="space-y-3">
            {upcomingActions.length > 0 ? upcomingActions.map(action => (
              <div key={action.id} className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-bold text-gray-900">{action.nextAction}</p>
                  <span className="text-[10px] font-bold text-orange-600 bg-white px-1.5 py-0.5 rounded border border-orange-100">
                    {action.nextActionDate ? format(new Date(action.nextActionDate), 'MMM d') : ''}
                  </span>
                </div>
                {action.relatedIdeaId && (
                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                    For: {data.ideas.find(i => i.id === action.relatedIdeaId)?.title}
                  </p>
                )}
              </div>
            )) : <p className="text-sm text-gray-400 italic">No actions scheduled for the coming days.</p>}
          </div>
        </section>
      </div>

      <div className="text-center pt-20 text-gray-300 text-[10px] font-bold uppercase tracking-widest hidden print:block">
        Generated by IdeaCRM Tracker · Confidential
      </div>
    </div>
  );
};

export default WeeklyReport;
