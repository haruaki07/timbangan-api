-- up migration
CREATE TABLE `records` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `child_id` INT UNSIGNED NOT NULL,
  `box_id` VARCHAR(10) NOT NULL,
  `weight` INT NOT NULL,
  `length` INT NOT NULL,
  `recorded_at` DATETIME NOT NULL,

  FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON DELETE CASCADE
)