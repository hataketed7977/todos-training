package com.example.todos.todo;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
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
								  "title": "Prepare training",
								  "description": "Create the first exercise",
								  "priority": "HIGH"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.title").value("Prepare training"))
				.andExpect(jsonPath("$.description").value("Create the first exercise"))
				.andExpect(jsonPath("$.priority").value("HIGH"))
				.andExpect(jsonPath("$.status").value("TODO"));

		mockMvc.perform(get("/api/todos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].title").value("Prepare training"));
	}

	@Test
	void movesTodoBetweenStatuses() throws Exception {
		var todo = todoRepository.save(new Todo("Implement CLI", null, TodoPriority.MEDIUM));

		mockMvc.perform(patch("/api/todos/{id}/status", todo.getId())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "status": "DOING"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("DOING"));
	}

	@Test
	void deletesTodoAndReturnsNotFoundAfterward() throws Exception {
		var todo = todoRepository.save(new Todo("Remove stale task", null, TodoPriority.LOW));

		mockMvc.perform(delete("/api/todos/{id}", todo.getId()))
				.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/todos/{id}", todo.getId()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("Todo not found: " + todo.getId()));
	}
}
