package com.bytedance.todos.model;

import jakarta.persistence.Column;
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

	@Enumerated(EnumType.STRING)
	private TodoStatus status = TodoStatus.TODO;

	@Column(length = 2000)
	private String description;

	@Enumerated(EnumType.STRING)
	private TodoPriority priority;

	private Instant createdAt;

	private Instant updatedAt;

	protected Todo() {
	}

	public Todo(String title) {
		this(title, null, null);
	}

	public Todo(String title, String description, TodoPriority priority) {
		this.title = title;
		this.description = description;
		this.priority = priority;
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

	public TodoPriority getPriority() {
		return priority;
	}

	public void setPriority(TodoPriority priority) {
		this.priority = priority;
	}

	public TodoStatus getStatus() {
		return status;
	}

	public void setStatus(TodoStatus status) {
		this.status = status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
