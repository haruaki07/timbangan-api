-- up migration
CREATE TABLE `weight_records` (
  `box_id` VARCHAR(10) NOT NULL,
  `weight` INT NOT NULL,
  `length` INT NOT NULL,
  `recorded_at` DATETIME NOT NULL
);