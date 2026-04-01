.PHONY: obtain

OBTAINED_DIRECTORY ?= obtained

OBTAINED = $(dir $(shell find '$(OBTAINED_DIRECTORY)' -name manifest.json -type f))

OBTAINED_INFERRED_DESCRIPTION = $(addsuffix inferred-description.json,$(OBTAINED))
OBTAINED_INFERRED_TRAITS = $(addsuffix inferred-traits.json,$(OBTAINED))
OBTAINED_INFERRED_IMAGES = $(addsuffix inferred-images.json,$(OBTAINED))
OBTAINED_INFERRED_FLOOR_PLANS = $(addsuffix inferred-floor-plans.json,$(OBTAINED))
OBTAINED_INFERRED_ADDRESS = $(addsuffix inferred-address.json,$(OBTAINED))

OBTAINED_INFERRED := \
	$(OBTAINED_INFERRED_DESCRIPTION) \
	$(OBTAINED_INFERRED_TRAITS) \
	$(OBTAINED_INFERRED_IMAGES) \
	$(OBTAINED_INFERRED_FLOOR_PLANS) \
	$(OBTAINED_INFERRED_ADDRESS)

$(OBTAINED_DIRECTORY)/%/inferred-description.json: \
	$(OBTAINED_DIRECTORY)/%/manifest.json \
	src/infer/task/description.ts \
	src/type/inferred/description.ts
	node src/infer/task/description.ts \
		--file-path-in-manifest '$<' \
		--file-path-out-inferred-description '$@'

$(OBTAINED_DIRECTORY)/%/inferred-traits.json: \
	$(OBTAINED_DIRECTORY)/%/manifest.json \
	src/infer/task/traits.ts \
	src/type/inferred/traits.ts
	node src/infer/task/traits.ts \
		--file-path-in-manifest '$<' \
		--file-path-out-inferred-traits '$@'

.SECONDEXPANSION:
$(OBTAINED_DIRECTORY)/%/inferred-images.json: \
	$$(wildcard $(OBTAINED_DIRECTORY)/$$*/image/*) \
	src/infer/task/images.ts \
	src/type/inferred/images.ts \
	| $(OBTAINED_DIRECTORY)/%/image
	node src/infer/task/images.ts \
		--directory-path-in-images '$(dir $<)' \
		--file-path-out-inferred-images '$@'

$(OBTAINED_DIRECTORY)/%/inferred-floor-plans.json: \
	$(OBTAINED_DIRECTORY)/%/inferred-images.json \
	src/infer/task/floor-plans.ts \
	src/type/inferred/floor-plans.ts \
	| $(OBTAINED_DIRECTORY)/%/image
	node src/infer/task/floor-plans.ts \
		--file-path-in-inferred-images '$<' \
		--file-path-out-inferred-floor-plans '$@'

$(OBTAINED_DIRECTORY)/%/inferred-address.json: \
	$(OBTAINED_DIRECTORY)/%/manifest.json \
	$(OBTAINED_DIRECTORY)/%/inferred-description.json \
	$(OBTAINED_DIRECTORY)/%/inferred-images.json \
	$(OBTAINED_DIRECTORY)/%/inferred-floor-plans.json \
	src/infer/task/address.ts \
	src/type/inferred/address.ts \
	| $(OBTAINED_DIRECTORY)/%/image
	node src/infer/task/address.ts \
		--file-path-in-manifest '$<' \
		--file-path-in-inferred-description '$(word 2,$^)' \
		--file-path-in-inferred-images '$(word 3,$^)' \
		--file-path-in-inferred-floor-plans '$(word 4,$^)' \
		--file-path-out-inferred-address '$@'

obtain: $(OBTAINED_INFERRED)
