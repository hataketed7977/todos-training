package com.bytedance.todos.controller;

import com.bytedance.todos.repository.TodoRepository;
import com.bytedance.todos.model.Todo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

}
