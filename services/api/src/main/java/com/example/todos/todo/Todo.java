package com.example.todos.todo;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "todos")
public class Todo {
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	private String description;

	@Enumerated(EnumType.STRING)
	private TodoStatus status = TodoStatus.TODO;

	@Enumerated(EnumType.STRING)
	private TodoPriority priority = TodoPriority.MEDIUM;

	private Instant createdAt;

	private Instant updatedAt;

	protected Todo() {
	}

	public Todo(String title, String description, TodoPriority priority) {
		this.title = title;
		this.description = description;
		this.priority = priority == null ? TodoPriority.MEDIUM : priority;
	}

	@PrePersist
	void onCreate() {
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		this.updatedAt = Instant.now();
	}

	public Long getId() {
		return id;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public TodoStatus getStatus() {
		return status;
	}

	public void setStatus(TodoStatus status) {
		this.status = status;
	}

	public TodoPriority getPriority() {
		return priority;
	}

	public void setPriority(TodoPriority priority) {
		this.priority = priority;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
