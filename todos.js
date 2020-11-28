const express = require('express');
const pug = require('pug');
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const morgan = require('morgan');
const TodoList = require('./lib/todolist');
const { loadTodoList } = require('./lib/sort');
const store = require("connect-loki");
const PgPersistence = require("./lib/pg-persistence");
const catchError = require("./lib/catch-error");

const app = express();
const host = "localhost";
const port = 3000;
const LokiStore = store(session);

// const { sortTodos } = require('./lib/sort');
// const Todo = require('./lib/todo');

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));


app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});


// const sortTodoLists = lists => {
//   return lists.slice().sort((todoListA, todoListB) => {
//     let isDoneA = todoListA.isDone();
//     let isDoneB = todoListB.isDone();

//     if (!isDoneA && isDoneB) {
//       return -1;
//     } else if (isDoneA && !isDoneB) {
//       return 1;
//     } else {
//       let titleA = todoListA.title;
//       let titleB = todoListB.title;

//       if (titleA < titleB) {
//         return -1;
//       } else if (titleA > titleB) {
//         return 1;
//       } else {
//         return 0;
//       }
//     }
//   });
// }


const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    // console.log("Unauthorized.");
    // res.status(401).send("Unauthorized.");
    res.redirect(302, '/users/sigin');
  } else {
    next();
  }
};

app.get('/', (req, res) => {
  res.redirect("/lists");
});

app.get("/lists", 
  requiresAuthentication,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let todoLists = await store.sortedTodoLists();
    let todosInfo = todoLists.map(todoList => ({
      countAllTodos: todoList.todos.length,
      countDoneTodos: todoList.todos.filter(todo => todo.done).length,
      isDone: store.isDoneTodoList(todoList),
    }));

    res.render("lists", {
      todoLists,
      todosInfo,
    });
  })
);

app.get("/lists/new",
  requiresAuthentication,
  (req, res) => {
    res.render("new-list");
  }
);


app.post("/lists",
  requiresAuthentication,
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
  ],
  catchError(async (req, res) => {
    let errors = validationResult(req);
    let todoListTitle = req.body.todoListTitle;

    const rerenderNewList = () => {
      res.render("new-list", {
        todoListTitle,
        flash: req.flash(),
      });
    };

    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderNewList();
    } else if (await res.locals.store.existsTodoListTitle(todoListTitle)) {
      req.flash("error", "The list title must be unique.");
      rerenderNewList();
    } else {
      let created = await res.locals.store.createTodoList(todoListTitle);
      if (!created) {
        req.flash("error", "The list title must be unique.");
        rerenderNewList();
      } else {
        req.flash("success", "The todo list has been created.");
        res.redirect("/lists");
      }
    }
  })
);

app.get("/lists/:todoListId",
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let todoList = await res.locals.store.loadTodoList(+todoListId);
    if (todoList === undefined) throw new Error("Not found.");

    todoList.todos = await res.locals.store.sortedTodos(todoList);

    res.render("list", {
      todoList,
      isDoneTodoList: res.locals.store.isDoneTodoList(todoList),
      hasUndoneTodos: res.locals.store.hasUndoneTodos(todoList),
    });
  })
);

app.post("/lists/:todoListId/todos/:todoId/toggle",
  requiresAuthentication,
  catchError(async (req, res) => {
    let { todoListId, todoId } = req.params;
    let toggled = await res.locals.store.toggleDoneTodo(+todoListId, +todoId);
    if (!toggled) throw new Error("Not found.");

    let todo = await res.locals.store.loadTodo(+todoListId, +todoId);
    if (todo.done) {
      req.flash("success", `"${todo.title}" marked done.`);
    } else {
      req.flash("success", `"${todo.title}" marked as NOT done!`);
    }

    res.redirect(`/lists/${todoListId}`);
  })
);

app.post("/lists/:todoListId/todos/:todoId/destroy",
  requiresAuthentication,
  catchError(async (req, res) => {
    let { todoListId, todoId } = req.params;
    let deleted = await res.locals.store.deleteTodo(+todoListId, +todoId);
    if (!deleted) throw new Error("Not found.");

    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
  })
);

app.post("/lists/:todoListId/complete_all",
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let completed = await res.locals.store.completeAllTodos(+todoListId);
    if (!completed) throw new Error("Not found.");

    req.flash("success", "All todos have been marked as done.");
    res.redirect(`/lists/${todoListId}`);
  })
);

app.post('/lists/:todoListId/todos', 
  requiresAuthentication,
  [
    body("todoTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Must not be empty")
    .isLength({ max: 100 })
    .withMessage("Cannot be more than 100 characters")
    
  ],
  catchError(async (req, res) => {
    let todoTitle = req.body.todoTitle;
    let todoListId = req.params.todoListId;

    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));

      let todoList = await res.locals.store.loadTodoList(+todoListId);
      if (!todoList) throw new Error("Not found.");

      todoList.todos = await res.locals.store.sortedTodos(todoList);

      res.render("list", {
        todoList,
        todoTitle,
        isDoneTodoList: res.locals.store.isDoneTodoList(todoList),
        hasUndoneTodos: res.locals.store.hasUndoneTodos(todoList),
        flash: req.flash(),
      });
    } else {
      let created = await res.locals.store.createTodo(+todoListId, todoTitle);
      if (!created) throw new Error("Not found.");

      req.flash("success", "The todo has been created.");
      res.redirect(`/lists/${todoListId}`);
    }
  }));

app.get("/lists/:todoListId/edit",
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let todoList = await res.locals.store.loadTodoList(+todoListId);
    if (!todoList) throw new Error("Not found.");

    res.render("edit-list", { todoList });
  })
);

app.post("/lists/:todoListId/destroy",
  requiresAuthentication,
  catchError(async (req, res) => {
    let todoListId = req.params.todoListId;
    let deleted = await res.locals.store.deleteTodoList(+todoListId);
    if (!deleted) throw new Error("Not found.");

    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  })
);

app.post("/lists/:todoListId/edit",
  requiresAuthentication,
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters."),
  ],
  // (req, res, next) => {
  //   let store = res.locals.store;
  //   let todoListId = req.params.todoListId;
  //   let todoListTitle = req.body.todoListTitle;

  //   const rerenderEditList = () => {
  //     let todoList = store.loadTodoList(+todoListId);
  //     if (!todoList) {
  //       next(new Error("Not found."));
  //     } else {
  //       res.render("edit-list", {
  //         todoListTitle,
  //         todoList,
  //         flash: req.flash(),
  //       });
  //     }
  //   };
  //   console.log(res.locals.store.existsTodoListTitle(todoListTitle));
  //   let errors = validationResult(req);
  //   if (!errors.isEmpty()) {
  //     errors.array().forEach(message => req.flash("error", message.msg));
  //     rerenderEditList();
  //   } else if (res.locals.store.existsTodoListTitle(todoListTitle)) { // Validation chain does not provide req..., therefore use flow control
  //     req.flash("error", "The list title must be unique.");
  //     rerenderEditList();
  //   } else if (!res.locals.store.setTodoListTitle(+todoListId,
  //                                                 todoListTitle)) {
  //     next(new Error("Not found."));
  //   } else {
  //     req.flash("success", "Todo list updated.");
  //     res.redirect(`/lists/${todoListId}`);
  //   }
  // }
  catchError(async (req, res) => {
    let store = res.locals.store;
    let todoListId = req.params.todoListId;
    let todoListTitle = req.body.todoListTitle;

    const rerenderEditList = async () => {
      let todoList = await store.loadTodoList(+todoListId);
      if (!todoList) throw new Error("Not found.");

      res.render("edit-list", {
        todoListTitle,
        todoList,
        flash: req.flash(),
      });
    };

    try {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        rerenderEditList();
      } else if (await store.existsTodoListTitle(todoListTitle)) {
        req.flash("error", "The list title must be unique.");
        rerenderEditList();
      } else {
        let updated = await store.setTodoListTitle(+todoListId, todoListTitle);
        if (!updated) throw new Error("Not found.");

        req.flash("success", "Todo list updated.");
        res.redirect(`/lists/${todoListId}`);
      }
    } catch (error) {
      if (store.isUniqueConstraintViolation(error)) {
        req.flash("error", "The list title must be unique.");
        rerenderEditList();
      } else {
        throw error;
      }
    }
  })
)

app.get("/users/signin", (req, res) => {
  req.flash("info", "Please sign in.");
  res.render("signin", {
    flash: req.flash(),
  });
});

app.post("/users/signin",
  catchError(async (req, res) => {
    let username = req.body.username.trim();
    let password = req.body.password;

    let authenticated = await res.locals.store.authenticate(username, password);
    if (!authenticated) {
      req.flash("error", "Invalid credentials.");
      res.render("signin", {
        flash: req.flash(),
        username: req.body.username,
      });
    } else {
      let session = req.session;
      session.username = username;
      session.signedIn = true;
      req.flash("info", "Welcome!");
      res.redirect("/lists");
    }
  })
);

app.post("/users/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect("/users/signin");
});

app.use((err, req, res, next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log("Server listening on port 3000");
});