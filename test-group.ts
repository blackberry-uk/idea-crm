function groupByDate(todos: any[]) {
  const map = new Map<string, any[]>();
  for (const todo of todos) {
    if (!todo.date) continue; // Skip floating tasks or handle them differently
    const key = String(todo.date).slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(todo);
  }
  return map;
}

const mockTodos = [
  { date: "2026-05-05T12:00:00.000Z", id: 1 },
  { date: null, id: 2 }
];

console.log(groupByDate(mockTodos));
