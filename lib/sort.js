// Compare object titles alphabetically (case-insensitive)
const compareByTitle = (itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } else if (titleA > titleB) {
    return 1;
  } else {
    return 0;
  }
};

const sortItems = (undone, done) => {
  undone.sort(compareByTitle);
  done.sort(compareByTitle);
  return [].concat(undone, done);
};

module.exports = {
  // // return the list of todo lists sorted by completion status and title.
  // sortTodoLists(done, undone) {
  //   undone.sort(compareByTitle);
  //   done.sort(compareByTitle);
  //   return [].concat(undone, done);
  // },

  // // sort a list of todos
  // sortTodos(undone, done) {
  //   // let undone = todoList.todos.filter(todo => !todo.isDone());
  //   // let done = todoList.todos.filter(todo => todo.isDone());
  //   undone.sort(compareByTitle);
  //   done.sort(compareByTitle);
  //   return [].concat(undone, done);
  // },

  sortTodoLists: sortItems,
  sortTodos: sortItems
};