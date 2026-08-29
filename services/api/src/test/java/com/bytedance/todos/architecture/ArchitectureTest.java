package com.bytedance.todos.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import jakarta.persistence.Entity;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class ArchitectureTest {

	private static final JavaClasses classes = new ClassFileImporter()
			.withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
			.importPackages("com.bytedance.todos");

	@Test
	void layeredDependenciesShouldBeUnidirectional() {
		ArchRule controllersOnlyDependOnServices = noClasses()
				.that().resideInAPackage("..controller..")
				.should().dependOnClassesThat().resideInAPackage("..repository..")
				.because("Controller 只能调用 Service，不能直接调用 Repository");

		ArchRule servicesOnlyDependOnRepositories = noClasses()
				.that().resideInAPackage("..service..")
				.should().dependOnClassesThat().resideInAPackage("..controller..")
				.because("Service 不能反向依赖 Controller");

		ArchRule repositoriesShouldNotDependOnHigherLayers = noClasses()
				.that().resideInAPackage("..repository..")
				.should().dependOnClassesThat().resideInAnyPackage("..controller..", "..service..")
				.because("Repository 不能反向依赖 Controller 或 Service");

		ArchRule controllersShouldOnlyAccessServicesViaServicePackage = classes()
				.that().resideInAPackage("..controller..")
				.should().onlyDependOnClassesThat()
				.resideInAnyPackage(
						"..controller..",
						"..service..",
						"..dto..",
						"..model..",
						"java..",
						"jakarta..",
						"org.springframework..",
						"org.slf4j..",
						"com.fasterxml.."
				)
				.because("Controller 只能调 Service，以及 DTO/Model/框架类");

		ArchRule servicesShouldOnlyAccessReposViaRepositoryPackage = classes()
				.that().resideInAPackage("..service..")
				.should().onlyDependOnClassesThat()
				.resideInAnyPackage(
						"..service..",
						"..repository..",
						"..dto..",
						"..model..",
						"java..",
						"jakarta..",
						"org.springframework..",
						"org.slf4j..",
						"com.fasterxml.."
				)
				.because("Service 只能调 Repository，以及 DTO/Model/框架类");

		controllersOnlyDependOnServices.check(classes);
		servicesOnlyDependOnRepositories.check(classes);
		repositoriesShouldNotDependOnHigherLayers.check(classes);
		controllersShouldOnlyAccessServicesViaServicePackage.check(classes);
		servicesShouldOnlyAccessReposViaRepositoryPackage.check(classes);
	}

	@Test
	void entityClassesShouldHaveEntitySuffix() {
		ArchRule rule = classes()
				.that().areAnnotatedWith(Entity.class)
				.should().haveSimpleNameEndingWith("Entity")
				.because("带 @Entity 的类名必须以 Entity 结尾");

		rule.check(classes);
	}
}
