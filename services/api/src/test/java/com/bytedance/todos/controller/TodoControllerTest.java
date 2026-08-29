package com.bytedance.todos.controller;

import com.bytedance.todos.repository.TodoRepository;
import com.bytedance.todos.model.TodoEntity;
import com.bytedance.todos.model.TodoStatus;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.cors.allowed-origin=http://localhost:15174")
@AutoConfigureMockMvc
class TodoControllerTest {
	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TodoRepository todoRepository;

	@BeforeEach
	void setUp() {
		todoRepository.deleteAll();
	}

	@Test
	void createsAndListsTodos() throws Exception {
		mockMvc.perform(post("/api/todos")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Prepare training"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.title").value("Prepare training"))
				.andExpect(jsonPath("$.status").value("TODO"));

		mockMvc.perform(get("/api/todos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].title").value("Prepare training"));
	}

	@Test
	void allowsConfiguredOriginForCorsPreflight() throws Exception {
		mockMvc.perform(options("/api/todos")
					.header("Origin", "http://localhost:15174")
					.header("Access-Control-Request-Method", "GET"))
				.andExpect(status().isOk())
				.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:15174"));
	}

	@Test
	void createsTodoWithTrimmedDescriptionAndPriority() throws Exception {
		mockMvc.perform(post("/api/todos")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Prepare training",
								  "description": "  准备培训材料和场地  ",
								  "priority": "HIGH"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.title").value("Prepare training"))
				.andExpect(jsonPath("$.status").value("TODO"))
				.andExpect(jsonPath("$.description").value("准备培训材料和场地"))
				.andExpect(jsonPath("$.priority").value("HIGH"));
	}

	@Test
	void createsTodoWithNullDescriptionAndPriorityWhenOmitted() throws Exception {
		mockMvc.perform(post("/api/todos")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Prepare training"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").value(nullValue()))
				.andExpect(jsonPath("$.priority").value(nullValue()));
	}

	@Test
	void normalizesBlankDescriptionToNull() throws Exception {
		mockMvc.perform(post("/api/todos")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Prepare training",
								  "description": "   "
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.description").value(nullValue()))
				.andExpect(jsonPath("$.priority").value(nullValue()));
	}

	@Test
	void rejectsInvalidPriority() throws Exception {
		mockMvc.perform(post("/api/todos")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Prepare training",
								  "priority": "URGENT"
								}
								"""))
				.andExpect(status().is4xxClientError());
	}

	@Test
	void deletesExistingTodo() throws Exception {
		TodoEntity todo = todoRepository.save(new TodoEntity("Prepare training"));

		mockMvc.perform(delete("/api/todos/" + todo.getId()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/todos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void returns404WhenDeletingNonExistentTodo() throws Exception {
		mockMvc.perform(delete("/api/todos/99999"))
				.andExpect(status().isNotFound());
	}

	@Test
	void updatesExistingTodoWithAllFields() throws Exception {
		TodoEntity todo = todoRepository.save(new TodoEntity("旧标题", "旧描述", com.bytedance.todos.model.TodoPriority.LOW));

		mockMvc.perform(put("/api/todos/" + todo.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "  新标题  ",
								  "description": "  新描述  ",
								  "priority": "HIGH"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("新标题"))
				.andExpect(jsonPath("$.description").value("新描述"))
				.andExpect(jsonPath("$.priority").value("HIGH"))
				.andExpect(jsonPath("$.status").value("TODO"))
				.andExpect(jsonPath("$.id").value(todo.getId()));

		mockMvc.perform(get("/api/todos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].title").value("新标题"))
				.andExpect(jsonPath("$[0].description").value("新描述"))
				.andExpect(jsonPath("$[0].priority").value("HIGH"));
	}

	@Test
	void updatesTodoClearsDescriptionAndPriority() throws Exception {
		TodoEntity todo = todoRepository.save(new TodoEntity("标题", "有描述", com.bytedance.todos.model.TodoPriority.HIGH));

		mockMvc.perform(put("/api/todos/" + todo.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "标题",
								  "description": "   ",
								  "priority": null
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.description").value(nullValue()))
				.andExpect(jsonPath("$.priority").value(nullValue()));
	}

	@Test
	void returns404WhenUpdatingNonExistentTodo() throws Exception {
		mockMvc.perform(put("/api/todos/99999")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "任意"
								}
								"""))
				.andExpect(status().isNotFound());
	}

	@Test
	void rejectsBlankTitleOnUpdate() throws Exception {
		TodoEntity todo = todoRepository.save(new TodoEntity("旧标题"));

		mockMvc.perform(put("/api/todos/" + todo.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "   "
								}
								"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void updateShouldChangeStatusWhenProvided() throws Exception {
		TodoEntity todo = todoRepository.save(new TodoEntity("旧标题", "旧描述", com.bytedance.todos.model.TodoPriority.LOW));

		mockMvc.perform(put("/api/todos/" + todo.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "新标题",
								  "description": null,
								  "priority": null,
								  "status": "DOING"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("新标题"))
				.andExpect(jsonPath("$.description").value(nullValue()))
				.andExpect(jsonPath("$.priority").value(nullValue()))
				.andExpect(jsonPath("$.status").value("DOING"))
				.andExpect(jsonPath("$.id").value(todo.getId()));

		TodoEntity saved = todoRepository.findById(todo.getId()).orElseThrow();
		assert saved.getStatus() == TodoStatus.DOING;
	}

	@Test
	void updateShouldPreserveStatusWhenOmitted() throws Exception {
		TodoEntity todo = todoRepository.save(new TodoEntity("旧标题", "旧描述", com.bytedance.todos.model.TodoPriority.LOW));
		todo.setStatus(TodoStatus.DONE);
		todo = todoRepository.save(todo);

		mockMvc.perform(put("/api/todos/" + todo.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "新标题",
								  "description": "新描述"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("新标题"))
				.andExpect(jsonPath("$.description").value("新描述"))
				.andExpect(jsonPath("$.status").value("DONE"))
				.andExpect(jsonPath("$.id").value(todo.getId()));
	}

	@Test
	void searchTodosByTitle_singleMatch() throws Exception {
		todoRepository.save(new TodoEntity("准备培训"));
		todoRepository.save(new TodoEntity("培训报告"));
		todoRepository.save(new TodoEntity("代码 review"));

		mockMvc.perform(get("/api/todos").param("title", "代码"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].title").value("代码 review"));
	}

	@Test
	void searchTodosByTitle_caseInsensitiveAndOrderedByCreatedAtDesc() throws Exception {
		todoRepository.save(new TodoEntity("Prepare training"));
		todoRepository.save(new TodoEntity("TRAINING report"));

		mockMvc.perform(get("/api/todos").param("title", "training"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)))
				.andExpect(jsonPath("$[0].title").value("TRAINING report"))
				.andExpect(jsonPath("$[1].title").value("Prepare training"));
	}

	@Test
	void searchTodosByTitle_noMatchReturnsEmptyArray() throws Exception {
		todoRepository.save(new TodoEntity("任意标题"));

		mockMvc.perform(get("/api/todos").param("title", "不存在关键词"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void searchTodosByTitle_blankTitleFallsBackToFullList() throws Exception {
		todoRepository.save(new TodoEntity("任务一"));
		todoRepository.save(new TodoEntity("任务二"));

		mockMvc.perform(get("/api/todos").param("title", "   "))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)));

		mockMvc.perform(get("/api/todos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)));
	}

	@Test
	void searchTodosByTitle_noParamPreservesOriginalFullListBehavior() throws Exception {
		todoRepository.save(new TodoEntity("任务一"));
		todoRepository.save(new TodoEntity("任务二"));
		todoRepository.save(new TodoEntity("任务三"));

		mockMvc.perform(get("/api/todos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(3)));
	}

}
