-- up migration
CREATE TABLE `children` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `birth_date` DATETIME,
  `birth_place` VARCHAR(255),
  `weight` INT,
  `length` INT,
  `weight_recorded_at` DATETIME,
  `parent_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT NOW(),
  `updated_at` DATETIME NULL,

  FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);