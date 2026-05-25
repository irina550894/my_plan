(function () {
  "use strict";

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MAX_FORWARD_WEEKS = 4;
  const STORAGE_KEY = "weekplanner_data";
  const MAX_TASK_TEXT_LENGTH = 200;

  const dayNames = [
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
    "Воскресенье"
  ];

  const dayTheme = [
    { solid: "#b42318", color: "rgba(180, 35, 24, 0.68)", hover: "rgba(180, 35, 24, 0.16)", soft: "rgba(180, 35, 24, 0.07)", border: "rgba(180, 35, 24, 0.34)" },
    { solid: "#b45309", color: "rgba(180, 83, 9, 0.68)", hover: "rgba(180, 83, 9, 0.16)", soft: "rgba(180, 83, 9, 0.07)", border: "rgba(180, 83, 9, 0.34)" },
    { solid: "#8a6a00", color: "rgba(138, 106, 0, 0.68)", hover: "rgba(138, 106, 0, 0.16)", soft: "rgba(138, 106, 0, 0.07)", border: "rgba(138, 106, 0, 0.34)" },
    { solid: "#137333", color: "rgba(19, 115, 51, 0.68)", hover: "rgba(19, 115, 51, 0.16)", soft: "rgba(19, 115, 51, 0.07)", border: "rgba(19, 115, 51, 0.34)" },
    { solid: "#0969da", color: "rgba(9, 105, 218, 0.68)", hover: "rgba(9, 105, 218, 0.16)", soft: "rgba(9, 105, 218, 0.07)", border: "rgba(9, 105, 218, 0.34)" },
    { solid: "#5145cd", color: "rgba(81, 69, 205, 0.68)", hover: "rgba(81, 69, 205, 0.16)", soft: "rgba(81, 69, 205, 0.07)", border: "rgba(81, 69, 205, 0.34)" },
    { solid: "#7e22ce", color: "rgba(126, 34, 206, 0.68)", hover: "rgba(126, 34, 206, 0.16)", soft: "rgba(126, 34, 206, 0.07)", border: "rgba(126, 34, 206, 0.34)" }
  ];

  const elements = {
    prevWeek: document.getElementById("prevWeek"),
    nextWeek: document.getElementById("nextWeek"),
    todayButton: document.getElementById("todayButton"),
    weekCode: document.getElementById("weekCode"),
    weekRange: document.getElementById("weekRange"),
    daysGrid: document.getElementById("daysGrid")
  };

  let currentWeekStart = startOfIsoWeek(new Date());
  let plannerData = loadPlannerData();
  let openForm = null;
  let pendingDeleteTaskId = null;
  let openMoveTaskId = null;

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function startOfIsoWeek(date) {
    const cleanDate = stripTime(date);
    const dayIndex = (cleanDate.getDay() + 6) % 7;
    return addDays(cleanDate, -dayIndex);
  }

  function getIsoWeek(date) {
    const cleanDate = stripTime(date);
    const thursday = addDays(cleanDate, 3 - ((cleanDate.getDay() + 6) % 7));
    const isoYear = thursday.getFullYear();
    const firstThursday = new Date(isoYear, 0, 4);
    const firstWeekStart = startOfIsoWeek(firstThursday);
    const weekNumber = Math.floor((thursday - firstWeekStart) / (7 * MS_PER_DAY)) + 1;

    return {
      year: isoYear,
      week: weekNumber,
      code: `${isoYear}-W${String(weekNumber).padStart(2, "0")}`
    };
  }

  function getWeekKey(date) {
    return getIsoWeek(date).code;
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseWeekKey(weekKey) {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);

    if (!match) {
      return null;
    }

    return {
      year: Number(match[1]),
      week: Number(match[2])
    };
  }

  function compareWeekKeys(firstWeekKey, secondWeekKey) {
    const first = parseWeekKey(firstWeekKey);
    const second = parseWeekKey(secondWeekKey);

    if (!first || !second) {
      return firstWeekKey.localeCompare(secondWeekKey);
    }

    if (first.year !== second.year) {
      return first.year - second.year;
    }

    return first.week - second.week;
  }

  function weeksBetween(start, end) {
    return Math.round((startOfIsoWeek(start) - startOfIsoWeek(end)) / (7 * MS_PER_DAY));
  }

  function isSameDay(firstDate, secondDate) {
    return stripTime(firstDate).getTime() === stripTime(secondDate).getTime();
  }

  function formatRangeDate(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatCardDate(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function loadPlannerData() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);
      if (!rawData) {
        return { weeks: {} };
      }

      const parsedData = JSON.parse(rawData);
      if (!parsedData || typeof parsedData !== "object" || !parsedData.weeks || typeof parsedData.weeks !== "object") {
        return { weeks: {} };
      }

      return parsedData;
    } catch (error) {
      return { weeks: {} };
    }
  }

  function savePlannerData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plannerData));
    } catch (error) {
      // Local storage can be unavailable in private modes; the app still works in memory.
    }
  }

  function pruneEmptyWeeks() {
    Object.keys(plannerData.weeks).forEach(function (weekKey) {
      const week = plannerData.weeks[weekKey];

      if (!week || !week.days) {
        delete plannerData.weeks[weekKey];
        return;
      }

      Object.keys(week.days).forEach(function (dateKey) {
        if (!Array.isArray(week.days[dateKey]) || week.days[dateKey].length === 0) {
          delete week.days[dateKey];
        }
      });

      if (Object.keys(week.days).length === 0) {
        delete plannerData.weeks[weekKey];
      }
    });
  }

  function showAutoMoveBanner(movedCount) {
    const banner = createElement("div", "auto-move-banner");
    const text = createElement("p", "auto-move-text", `Перенесено ${movedCount} задач из прошлых недель...`);
    const closeButton = createElement("button", "auto-move-close", "×");
    const removeBanner = function () {
      if (banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    };

    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Закрыть уведомление");
    closeButton.addEventListener("click", removeBanner);

    banner.appendChild(text);
    banner.appendChild(closeButton);
    document.body.insertBefore(banner, document.body.firstChild);
    window.setTimeout(removeBanner, 5000);
  }

  function initApp() {
    const today = stripTime(new Date());
    const todayKey = getDateKey(today);
    const currentWeekKey = getWeekKey(today);
    const currentWeekStart = startOfIsoWeek(today);
    const todayDayOfWeek = ((today.getDay() + 6) % 7) + 1;
    const lastVisitDate = plannerData.lastVisitDate || null;
    let movedCount = 0;

    Object.keys(plannerData.weeks).forEach(function (weekKey) {
      if (compareWeekKeys(weekKey, currentWeekKey) >= 0) {
        return;
      }

      const week = plannerData.weeks[weekKey];
      if (!week || !week.days) {
        delete plannerData.weeks[weekKey];
        return;
      }

      Object.keys(week.days).forEach(function (dateKey) {
        const tasks = Array.isArray(week.days[dateKey]) ? week.days[dateKey] : [];

        tasks.forEach(function (task) {
          if (isTaskDone(task)) {
            return;
          }

          const sourceDayOfWeek = task.dayOfWeek || getDayOfWeekFromDateKey(dateKey);
          const targetDayOfWeek = sourceDayOfWeek > todayDayOfWeek ? sourceDayOfWeek : todayDayOfWeek;
          const targetDate = addDays(currentWeekStart, targetDayOfWeek - 1);
          const targetDateKey = getDateKey(targetDate);

          task.weekKey = currentWeekKey;
          task.dayOfWeek = targetDayOfWeek;
          task.movedFrom = {
            weekKey: weekKey,
            dateKey: dateKey,
            dayOfWeek: sourceDayOfWeek,
            lastVisitDate: lastVisitDate,
            movedAt: Date.now()
          };
          task.updatedAt = Date.now();

          ensureDayTasks(currentWeekKey, targetDateKey).push(task);
          movedCount += 1;
        });

        delete week.days[dateKey];
      });
    });

    pruneEmptyWeeks();
    plannerData.lastVisitDate = todayKey;
    savePlannerData();

    if (movedCount > 0) {
      showAutoMoveBanner(movedCount);
    }
  }

  function ensureDayTasks(weekKey, dateKey) {
    if (!plannerData.weeks[weekKey]) {
      plannerData.weeks[weekKey] = { days: {} };
    }

    if (!plannerData.weeks[weekKey].days) {
      plannerData.weeks[weekKey].days = {};
    }

    if (!Array.isArray(plannerData.weeks[weekKey].days[dateKey])) {
      plannerData.weeks[weekKey].days[dateKey] = [];
    }

    return plannerData.weeks[weekKey].days[dateKey];
  }

  function getSortedTasks(weekKey, dateKey) {
    return ensureDayTasks(weekKey, dateKey).slice().sort(function (firstTask, secondTask) {
      if (firstTask.time !== secondTask.time) {
        return firstTask.time.localeCompare(secondTask.time);
      }

      return firstTask.createdAt - secondTask.createdAt;
    });
  }

  function isTaskDone(task) {
    return task.status === "done";
  }

  function getProgress(tasks) {
    const total = tasks.length;
    const done = tasks.filter(isTaskDone).length;

    return {
      done: done,
      total: total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0
    };
  }

  function createTaskId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeTaskText(value) {
    return value.trim().slice(0, MAX_TASK_TEXT_LENGTH);
  }

  function closeTransientUi() {
    openForm = null;
    pendingDeleteTaskId = null;
    openMoveTaskId = null;
  }

  function openTaskForm(dateKey, taskId) {
    openForm = { dateKey: dateKey, taskId: taskId || null };
    pendingDeleteTaskId = null;
    openMoveTaskId = null;
    render();
  }

  function addTask(weekKey, dateKey, dayOfWeek, taskData) {
    ensureDayTasks(weekKey, dateKey).push({
      id: createTaskId(),
      text: taskData.text,
      time: taskData.time,
      status: "active",
      weekKey: weekKey,
      dayOfWeek: dayOfWeek,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    savePlannerData();
  }

  function updateTask(weekKey, dateKey, taskId, taskData) {
    const task = ensureDayTasks(weekKey, dateKey).find(function (item) {
      return item.id === taskId;
    });

    if (task) {
      task.text = taskData.text;
      task.time = taskData.time;
      task.weekKey = task.weekKey || weekKey;
      task.updatedAt = Date.now();
      savePlannerData();
    }
  }

  function toggleTaskStatus(weekKey, dateKey, taskId) {
    const task = ensureDayTasks(weekKey, dateKey).find(function (item) {
      return item.id === taskId;
    });

    if (task) {
      task.status = isTaskDone(task) ? "active" : "done";
      task.weekKey = task.weekKey || weekKey;
      task.updatedAt = Date.now();
      savePlannerData();
    }
  }

  function moveTask(sourceWeekKey, sourceDateKey, targetWeekKey, targetDateKey, targetDayOfWeek, taskId) {
    const sourceTasks = ensureDayTasks(sourceWeekKey, sourceDateKey);
    const taskIndex = sourceTasks.findIndex(function (task) {
      return task.id === taskId;
    });

    if (taskIndex === -1) {
      return;
    }

    const task = sourceTasks[taskIndex];
    const sourceDayOfWeek = task.dayOfWeek || getDayOfWeekFromDateKey(sourceDateKey);

    sourceTasks.splice(taskIndex, 1);
    task.weekKey = targetWeekKey;
    task.dayOfWeek = targetDayOfWeek;
    task.movedFrom = {
      weekKey: sourceWeekKey,
      dateKey: sourceDateKey,
      dayOfWeek: sourceDayOfWeek,
      movedAt: Date.now()
    };
    task.updatedAt = Date.now();

    ensureDayTasks(targetWeekKey, targetDateKey).push(task);
    savePlannerData();
  }

  function deleteTask(weekKey, dateKey, taskId) {
    const tasks = ensureDayTasks(weekKey, dateKey);
    const nextTasks = tasks.filter(function (task) {
      return task.id !== taskId;
    });

    plannerData.weeks[weekKey].days[dateKey] = nextTasks;
    savePlannerData();
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (typeof text === "string") {
      element.textContent = text;
    }

    return element;
  }

  function getDayOfWeekFromDateKey(dateKey) {
    const parts = dateKey.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);

    return ((date.getDay() + 6) % 7) + 1;
  }

  function createTaskForm(weekKey, dateKey, task) {
    const form = createElement("form", "task-form");
    const textLabel = createElement("label", "field-label", "Задача");
    const textInput = createElement("textarea", "task-text-input");
    const timeLabel = createElement("label", "field-label", "Время");
    const timeInput = createElement("input", "task-time-input");
    const actions = createElement("div", "task-form-actions");
    const saveButton = createElement("button", "save-task-button", "Сохранить");
    const cancelButton = createElement("button", "cancel-task-button", "Отмена");

    textInput.maxLength = MAX_TASK_TEXT_LENGTH;
    textInput.required = true;
    textInput.rows = 3;
    textInput.value = task ? task.text : "";
    textInput.placeholder = "Текст задачи";

    timeInput.type = "time";
    timeInput.value = task ? task.time : "09:00";

    saveButton.type = "submit";
    saveButton.disabled = normalizeTaskText(textInput.value).length === 0;
    cancelButton.type = "button";

    textInput.addEventListener("input", function () {
      if (textInput.value.length > MAX_TASK_TEXT_LENGTH) {
        textInput.value = textInput.value.slice(0, MAX_TASK_TEXT_LENGTH);
      }

      saveButton.disabled = normalizeTaskText(textInput.value).length === 0;
    });

    cancelButton.addEventListener("click", function () {
      closeTransientUi();
      render();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const text = normalizeTaskText(textInput.value);
      if (!text) {
        saveButton.disabled = true;
        return;
      }

      const taskData = {
        text: text,
        time: timeInput.value || "09:00"
      };

      if (task) {
        updateTask(weekKey, dateKey, task.id, taskData);
      } else {
        addTask(weekKey, dateKey, getDayOfWeekFromDateKey(dateKey), taskData);
      }

      closeTransientUi();
      render();
    });

    textLabel.appendChild(textInput);
    timeLabel.appendChild(timeInput);
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    form.appendChild(textLabel);
    form.appendChild(timeLabel);
    form.appendChild(actions);

    window.setTimeout(function () {
      textInput.focus();
    }, 0);

    return form;
  }

  function createMoveDropdown(sourceWeekKey, sourceDateKey, sourceWeekStart, sourceDayIndex, task) {
    const dropdown = createElement("div", "move-dropdown");
    const weeks = [
      { title: "Текущая неделя", start: sourceWeekStart },
      { title: "Следующая неделя", start: addDays(sourceWeekStart, 7) }
    ];

    weeks.forEach(function (week) {
      const section = createElement("div", "move-section");
      const title = createElement("p", "move-section-title", week.title);
      const buttons = createElement("div", "move-day-buttons");

      section.appendChild(title);

      dayNames.forEach(function (dayName, index) {
        const targetDate = addDays(week.start, index);
        const targetWeekKey = getWeekKey(targetDate);
        const targetDateKey = getDateKey(targetDate);
        const targetDayOfWeek = index + 1;
        const button = createElement("button", "move-day-button", dayName.slice(0, 2));
        const isCurrentDay = targetWeekKey === sourceWeekKey && targetDateKey === sourceDateKey;

        button.type = "button";
        button.title = `${dayName}, ${formatCardDate(targetDate)}`;
        button.disabled = isCurrentDay;

        button.addEventListener("click", function () {
          moveTask(sourceWeekKey, sourceDateKey, targetWeekKey, targetDateKey, targetDayOfWeek, task.id);
          closeTransientUi();
          render();
        });

        buttons.appendChild(button);
      });

      section.appendChild(buttons);
      dropdown.appendChild(section);
    });

    return dropdown;
  }

  function createTaskItem(weekKey, dateKey, dayDate, dayIndex, task) {
    const done = isTaskDone(task);
    const item = createElement("li", done ? "task-item is-done" : "task-item");
    const checkbox = createElement("input", "task-checkbox");
    const main = createElement("div", "task-main");
    const time = createElement("time", "task-time", task.time);
    const text = createElement("p", "task-text", task.text);
    const actions = createElement("div", "task-actions");
    const editButton = createElement("button", "task-icon-button", "✏");
    const moveButton = createElement("button", "task-icon-button", "↗");
    const deleteButton = createElement("button", "task-icon-button danger", "🗑");

    task.weekKey = task.weekKey || weekKey;
    task.dayOfWeek = task.dayOfWeek || dayIndex + 1;
    checkbox.type = "checkbox";
    checkbox.checked = done;
    checkbox.setAttribute("aria-label", "Отметить задачу выполненной");
    time.dateTime = task.time;
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Редактировать задачу");
    moveButton.type = "button";
    moveButton.setAttribute("aria-label", "Перенести задачу");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Удалить задачу");

    editButton.addEventListener("click", function () {
      openTaskForm(dateKey, task.id);
    });

    deleteButton.addEventListener("click", function () {
      openForm = null;
      openMoveTaskId = null;
      pendingDeleteTaskId = task.id;
      render();
    });

    checkbox.addEventListener("change", function () {
      openMoveTaskId = null;
      toggleTaskStatus(weekKey, dateKey, task.id);
      render();
    });

    moveButton.addEventListener("click", function () {
      openForm = null;
      pendingDeleteTaskId = null;
      openMoveTaskId = openMoveTaskId === task.id ? null : task.id;
      render();
    });

    main.appendChild(time);
    actions.appendChild(editButton);
    if (!done) {
      actions.appendChild(moveButton);
    }
    actions.appendChild(deleteButton);
    item.appendChild(checkbox);
    item.appendChild(main);
    item.appendChild(text);
    item.appendChild(actions);

    if (!done && openMoveTaskId === task.id) {
      item.appendChild(createMoveDropdown(weekKey, dateKey, startOfIsoWeek(dayDate), dayIndex, task));
    }

    if (pendingDeleteTaskId === task.id) {
      const confirmBox = createElement("div", "delete-confirm");
      const confirmText = createElement("p", "delete-confirm-text", "Удалить задачу?");
      const confirmDelete = createElement("button", "confirm-delete-button", "Удалить");
      const cancelDelete = createElement("button", "cancel-delete-button", "Отмена");

      confirmDelete.type = "button";
      cancelDelete.type = "button";

      confirmDelete.addEventListener("click", function () {
        deleteTask(weekKey, dateKey, task.id);
        closeTransientUi();
        render();
      });

      cancelDelete.addEventListener("click", function () {
        pendingDeleteTaskId = null;
        render();
      });

      confirmBox.appendChild(confirmText);
      confirmBox.appendChild(confirmDelete);
      confirmBox.appendChild(cancelDelete);
      item.appendChild(confirmBox);
    }

    return item;
  }

  function createProgressBar(tasks) {
    const progress = getProgress(tasks);
    const progressWrap = createElement("div", "day-progress");
    const progressTrack = createElement("div", "day-progress-track");
    const progressFill = createElement("div", "day-progress-fill");
    const progressText = createElement("span", "day-progress-text", `${progress.done}/${progress.total}`);

    progressFill.style.width = `${progress.percent}%`;
    progressTrack.appendChild(progressFill);
    progressWrap.appendChild(progressTrack);
    progressWrap.appendChild(progressText);

    return progressWrap;
  }

  function createDayCard(dayName, dayDate, index, today, weekKey) {
    const dateKey = getDateKey(dayDate);
    const card = createElement("article", isSameDay(dayDate, today) ? "day-card is-today" : "day-card");
    const content = createElement("div", "day-content");
    const header = createElement("div", "day-header");
    const headingWrap = createElement("div", "");
    const title = createElement("h2", "day-name", dayName);
    const date = createElement("p", "day-date", formatCardDate(dayDate));
    const tasks = getSortedTasks(weekKey, dateKey);
    const taskList = createElement("ul", "task-list");
    const footer = createElement("div", "empty-state");
    const addButton = createElement("button", "add-task-button", "+ Добавить задачу");
    const editingTask = tasks.find(function (task) {
      return openForm && openForm.dateKey === dateKey && openForm.taskId === task.id;
    });

    card.style.setProperty("--day-color", dayTheme[index].color);
    card.style.setProperty("--day-soft", dayTheme[index].soft);
    card.style.setProperty("--day-border", dayTheme[index].border);
    card.style.setProperty("--day-solid", dayTheme[index].solid);

    headingWrap.appendChild(title);
    headingWrap.appendChild(date);
    headingWrap.appendChild(createProgressBar(tasks));
    header.appendChild(headingWrap);

    tasks.forEach(function (task) {
      if (editingTask && editingTask.id === task.id) {
        const formItem = createElement("li", "task-item is-editing");
        formItem.appendChild(createTaskForm(weekKey, dateKey, task));
        taskList.appendChild(formItem);
        return;
      }

      taskList.appendChild(createTaskItem(weekKey, dateKey, dayDate, index, task));
    });

    addButton.type = "button";
    addButton.addEventListener("click", function () {
      openTaskForm(dateKey);
    });

    footer.appendChild(addButton);
    content.appendChild(header);
    content.appendChild(taskList);

    if (openForm && openForm.dateKey === dateKey && openForm.taskId === null) {
      content.appendChild(createTaskForm(weekKey, dateKey, null));
    }

    content.appendChild(footer);
    card.appendChild(content);

    return card;
  }

  function render() {
    const today = stripTime(new Date());
    const thisWeekStart = startOfIsoWeek(today);
    const weekEnd = addDays(currentWeekStart, 6);
    const isoWeek = getIsoWeek(currentWeekStart);
    const weekKey = getWeekKey(currentWeekStart);
    const forwardOffset = weeksBetween(currentWeekStart, thisWeekStart);
    const todayIndex = (today.getDay() + 6) % 7;

    elements.weekCode.textContent = isoWeek.code;
    elements.weekRange.textContent = `${formatRangeDate(currentWeekStart)} - ${formatRangeDate(weekEnd)}`;
    elements.todayButton.style.setProperty("--today-color", dayTheme[todayIndex].soft);
    elements.todayButton.style.setProperty("--today-hover", dayTheme[todayIndex].hover);
    elements.todayButton.style.setProperty("--today-border", dayTheme[todayIndex].border);
    elements.todayButton.style.setProperty("--today-text", dayTheme[todayIndex].solid);
    elements.nextWeek.disabled = forwardOffset >= MAX_FORWARD_WEEKS;
    elements.daysGrid.textContent = "";

    dayNames.forEach(function (dayName, index) {
      elements.daysGrid.appendChild(createDayCard(dayName, addDays(currentWeekStart, index), index, today, weekKey));
    });
  }

  elements.prevWeek.addEventListener("click", function () {
    currentWeekStart = addDays(currentWeekStart, -7);
    closeTransientUi();
    render();
  });

  elements.nextWeek.addEventListener("click", function () {
    const nextWeekStart = addDays(currentWeekStart, 7);
    const thisWeekStart = startOfIsoWeek(new Date());

    if (weeksBetween(nextWeekStart, thisWeekStart) <= MAX_FORWARD_WEEKS) {
      currentWeekStart = nextWeekStart;
      closeTransientUi();
      render();
    }
  });

  elements.todayButton.addEventListener("click", function () {
    currentWeekStart = startOfIsoWeek(new Date());
    closeTransientUi();
    render();
  });

  initApp();
  render();
}());
