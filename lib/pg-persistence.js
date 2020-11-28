const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  // constructor(session) {
  //   this._todoLists = session.todoLists || deepCopy(SeedData);
  //   session.todoLists = this._todoLists;
  // }

  constructor(session) {
    this.username = session.username;
  }

  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
    // return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
    // return todoList.todos.some(todo => !todo.done);
  }

  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists" +
                        "  WHERE username = $1" +
                        "  ORDER BY lower(title) ASC";
    const ALL_TODOS =     "SELECT * FROM todos" +
                          "  WHERE username = $1";

    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(ALL_TODOS, this.username);
    let resultBoth = await Promise.all([resultTodoLists, resultTodos]);

    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;
    if (!allTodoLists || !allTodos) return undefined;

    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id === todo.todolist_id;
      });
    });

  return this._partitionTodoLists(allTodoLists);
    // let todoLists = deepCopy(this._todoLists);
    // let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    // let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    // return sortTodoLists(undone, done);
  }

  async sortedTodos(todoList) {
    const SORTED_TODOS = "SELECT * FROM todos" +
                         "  WHERE todolist_id = $1 AND username = $2" +
                         "  ORDER BY done ASC, lower(title) ASC";

    let result = await dbQuery(SORTED_TODOS, todoList.id, this.username);
    return result.rows;
    // let todos = todoList.todos;
    // let undone = todos.filter(todo => !todo.done);
    // let done = todos.filter(todo => todo.done);
    // return sortTodos(undone, done);
  }

  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists" +
                          "  WHERE id = $1 AND username = $2";
    const FIND_TODOS = "SELECT * FROM todos" +
                       "  WHERE todolist_id = $1 AND username = $2";

    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId, this.username);
    let resultTodos = dbQuery(FIND_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    
    todoList.todos = resultBoth[1].rows; // todoList lacks the todos property, so you assign it yourself
    return todoList;
    // let todoList = this._findTodoList(todoListId);
    // return deepCopy(todoList);
  }

  async loadTodo(todoListId, todoId) {

    const FIND_TODO = "SELECT * FROM todos" +
                      "  WHERE todolist_id = $1 AND id = $2 AND username = $3";

    let result = await dbQuery(FIND_TODO, todoListId, todoId, this.username);
    return result.rows[0];
    // let todo = this._findTodo(todoListId, todoId);
    // return deepCopy(todo);
  }

  async toggleDoneTodo(todoListId, todoId) {
    const TOGGLE_DONE = "UPDATE todos SET done = NOT done" +
                        "  WHERE todolist_id = $1" +
                        "    AND id = $2" +
                        "    AND username = $3";

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId, this.username);
    return result.rowCount > 0;
    // let todo = this._findTodo(todoListId, todoId);
    // if (!todo) return false;

    // todo.done = !todo.done;
    // return true;
  }

  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = "DELETE FROM todos" +
                        "  WHERE todolist_id = $1" +
                        "    AND id = $2" +
                        "    AND username = $3";

    let result = await dbQuery(DELETE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return false;

    // let todoIndex = todoList.todos.findIndex(todo => todo.id === todoId);
    // if (todoIndex === -1) return false;

    // todoList.todos.splice(todoIndex, 1);
    // return true;
  }

  async completeAllTodos(todoListId) {
    const COMPLETE_ALL = "UPDATE todos SET done = TRUE" +
                         "  WHERE todolist_id = $1 AND NOT done" +
                         "    AND username = $2";

    let result = await dbQuery(COMPLETE_ALL, todoListId, this.username);
    return result.rowCount > 0;
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return false;

    // todoList.todos.filter(todo => !todo.done)
    //               .forEach(todo => (todo.done = true));
    // return true;
  }

  async createTodo(todoListId, title) {
    const CREATE_TODO = "INSERT INTO todos" +
                        "  (title, todolist_id, username)" +
                        "  VALUES ($1, $2, $3)";

    let result = await dbQuery(CREATE_TODO, title, todoListId, this.username);
    return result.rowCount > 0;
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return false;

    // todoList.todos.push({
    //   title,
    //   id: nextId(),
    //   done: false,
    // });

    // return true;
  }

  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = "DELETE FROM todolists" +
                            "  WHERE id = $1 AND username = $2";

    let result = await dbQuery(DELETE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
    // let todoListIndex = this._todoLists.findIndex(todoList => {
    //   return todoList.id === todoListId;
    // });

    // if (todoListIndex === -1) return false;

    // this._todoLists.splice(todoListIndex, 1);
    // return true;
  }

  async setTodoListTitle(todoListId, title) {
    const UPDATE_TITLE = "UPDATE todolists" +
                         "  SET title = $1" +
                         "  WHERE id = $2 AND username = $3";

    let result = await dbQuery(UPDATE_TITLE, title, todoListId, this.username);
    return result.rowCount > 0;
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return false;

    // todoList.title = title;
    // return true;
  }

  async existsTodoListTitle(title) {
    const FIND_TODOLIST = "SELECT null FROM todolists" +
                          "  WHERE title = $1 AND username = $2";

    let result = await dbQuery(FIND_TODOLIST, title, this.username);
    return result.rowCount > 0;
    // return this._todoLists.some(todoList => todoList.title === title);
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  async createTodoList(title) {
    const CREATE_TODOLIST = "INSERT INTO todolists (title, username)" +
                            "  VALUES ($1, $2)";

    try {
      // let result = await dbQuery(CREATE_TODOLIST, title); // Compare with the other unique constraint error, where did not use try/catch
      let result = await dbQuery(CREATE_TODOLIST, title, this.username);
      return result.rowCount > 0; // in the method but instead use another flow control inside todos.js with isUniqueConstraintViolation
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
    // this._todoLists.push({
    //   id: nextId(),
    //   title,
    //   todos: []
    // });

    // return true;
  }

  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
                                 "  WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }

  // _findTodoList(todoListId) {
  //   // return this._todoLists.find(todoList => todoList.id === todoListId);
  // }
  
  // _findTodo(todoListId, todoId) {
  //   // let todoList = this._findTodoList(todoListId);
  //   // if (!todoList) return undefined;

  //   // return todoList.todos.find(todo => todo.id === todoId);
  // }

};