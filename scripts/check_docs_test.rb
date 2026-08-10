#!/usr/bin/env ruby

require "fileutils"
require "minitest/autorun"
require "pathname"
require "tmpdir"

require_relative "check_docs"

class DocumentationContractTest < Minitest::Test
  def test_required_file_rejects_symlink
    Dir.mktmpdir do |directory|
      root = Pathname.new(directory)
      root.join("README.md").make_symlink("/etc/hosts")
      errors = []

      assert_nil validate_required_file(root, "README.md", errors)
      assert errors.any? { |error| error.include?("symlink") }
    end
  end

  def test_local_link_rejects_symlink_target_outside_root
    Dir.mktmpdir do |directory|
      base = Pathname.new(directory)
      root = base.join("repo").tap(&:mkpath)
      outside = base.join("outside").tap(&:mkpath)
      outside.join("document.md").write("# Outside\n", encoding: "UTF-8")
      root.join("linked").make_symlink(outside)
      source = root.join("README.md").tap { |path| path.write("[outside](linked/document.md)\n", encoding: "UTF-8") }
      errors = []

      validate_markdown_links(source, root, errors)

      assert errors.any? { |error| error.include?("resolves outside repository") }
    end
  end

  def test_scanned_text_rejects_symlink
    Dir.mktmpdir do |directory|
      root = Pathname.new(directory)
      root.join("scan.md").make_symlink("/etc/hosts")
      errors = []

      assert_nil read_utf8(root.join("scan.md"), errors, root)
      assert errors.any? { |error| error.include?("symlink") }
    end
  end

  def test_markdown_parser_handles_commonmark_destinations_and_ignores_code
    errors = []
    markdown = <<~MARKDOWN
      [angle](<docs/My File (1).md>)
      [balanced](docs/file_(draft).md)
      [reference][guide]

      [guide]: <docs/Reference File (2).md>
      [external](//example.com/path)
      `[inline](ignored-inline.md)`

          [indented](ignored-indented.md)

      ~~~markdown
      [fenced](ignored-fenced.md)
      ~~~

      ```markdown
      [backtick-fenced](ignored-backtick-fenced.md)
      ```
    MARKDOWN

    targets = markdown_link_targets(markdown, "fixture.md", errors)

    assert_empty errors
    assert_includes targets, "docs/My%20File%20(1).md"
    assert_includes targets, "docs/file_(draft).md"
    assert_includes targets, "docs/Reference%20File%20(2).md"
    assert_includes targets, "//example.com/path"
    refute_includes targets, "ignored-inline.md"
    refute_includes targets, "ignored-indented.md"
    refute_includes targets, "ignored-fenced.md"
    refute_includes targets, "ignored-backtick-fenced.md"
  end

  def test_markdown_parser_treats_malformed_link_syntax_as_text
    errors = []

    targets = markdown_link_targets("[broken](<missing\n", "fixture.md", errors)

    assert_empty targets
    assert_empty errors
  end

  def test_markdown_parser_failure_is_reported_without_an_exception
    errors = []
    missing = Pathname.new(Dir.tmpdir).join("missing-markdown-helper-#{Process.pid}.mjs")

    result = parse_markdown("# Heading\n", "fixture.md", errors, helper: missing)

    assert_nil result
    assert errors.any? { |error| error.include?("Markdown parser failed") }
  end

  def test_markdown_parser_uses_commonmark_link_and_code_semantics
    errors = []
    markdown = <<~'MARKDOWN'
      [angle](<docs/file.md> "title")
      [parenthesized](docs/file.md (title))
      plain text ](not-a-link.md)
      escaped \](not-a-link-either.md)
      `multi-line code
      [inside](ignored-code.md)`
    MARKDOWN

    targets = markdown_link_targets(markdown, "fixture.md", errors)

    assert_empty errors
    assert_equal ["docs/file.md", "docs/file.md"], targets
  end

  def test_anchor_validation_supports_fragments_encoding_and_duplicates
    Dir.mktmpdir do |directory|
      root = Pathname.new(directory)
      target = root.join("target.md")
      target.write("# Hello World\n\n## Hello World\n\n# 中文\n", encoding: "UTF-8")
      source = root.join("README.md")
      source.write(<<~MARKDOWN, encoding: "UTF-8")
        # Local Heading

        [local](#local-heading)
        [duplicate](target.md#hello-world-1)
        [encoded](target.md#%E4%B8%AD%E6%96%87)
        [external](//example.com/page#ignored)
      MARKDOWN
      errors = []

      validate_markdown_links(source, root, errors)

      assert_empty errors
    end
  end

  def test_anchor_validation_rejects_missing_fragment
    Dir.mktmpdir do |directory|
      root = Pathname.new(directory)
      source = root.join("README.md")
      source.write("# Present\n\n[missing](#absent)\n", encoding: "UTF-8")
      errors = []

      validate_markdown_links(source, root, errors)

      assert errors.any? { |error| error.include?("missing Markdown anchor: absent") }
    end
  end

  def test_link_validation_separates_query_and_uses_github_slugger_collisions
    Dir.mktmpdir do |directory|
      root = Pathname.new(directory)
      target = root.join("target.md")
      target.write("Foo\n===\n\nFoo-1\n-----\n\n# Foo\n", encoding: "UTF-8")
      source = root.join("README.md")
      source.write(<<~MARKDOWN, encoding: "UTF-8")
        [first](target.md?download=1#foo)
        [literal-suffix](target.md#foo-1)
        [collision](target.md#foo-2)
      MARKDOWN
      errors = []

      validate_markdown_links(source, root, errors)

      assert_empty errors
    end
  end

  def test_capability_claims_bind_negation_to_each_predicate
    cases = {
      "Cert Viewer has an MCP server." => ["MCP integration"],
      "Cert Viewer does not have an MCP server." => [],
      "Cert Viewer 提供 MCP server。" => ["MCP integration"],
      "Cert Viewer 不提供 MCP server。" => [],
      "Cert Viewer checks certificate chains." => ["chain validation"],
      "Cert Viewer does not check certificate chains." => [],
      "Cert Viewer 检查证书链。" => ["chain validation"],
      "Cert Viewer 不检查证书链。" => [],
      "Cert Viewer makes trust decisions." => ["trust decision"],
      "Cert Viewer does not make trust decisions." => [],
      "Cert Viewer 做出信任决策。" => ["trust decision"],
      "Cert Viewer 不做出信任决策。" => [],
      "Cert Viewer provides hostname verification." => ["hostname verification"],
      "Cert Viewer does not provide hostname verification." => [],
      "Cert Viewer 提供 hostname verification。" => ["hostname verification"],
      "Cert Viewer 不提供 hostname verification。" => [],
      "Cert Viewer presents a verified chain." => ["verified chain"],
      "Cert Viewer does not present a verified chain." => [],
      "Cert Viewer 显示 verified chain。" => ["verified chain"],
      "Cert Viewer 不显示 verified chain。" => [],
      "Cert Viewer does not upload certificates and verifies trust." => ["trust decision"],
      "Cert Viewer does not upload certificates but checks certificate chains." => ["chain validation"],
      "Cert Viewer 不上传证书，但提供 hostname verification。" => ["hostname verification"],
      "Cert Viewer does not upload certificates and has an MCP server." => ["MCP integration"],
      "Cert Viewer 不上传证书，但提供 MCP server。" => ["MCP integration"],
      "Cert Viewer 不上传证书，但检查证书链。" => ["chain validation"],
      "Cert Viewer 不上传证书，但做出信任决策。" => ["trust decision"],
      "Cert Viewer does not upload certificates and provides hostname verification." => ["hostname verification"],
      "Cert Viewer does not upload certificates and presents a verified chain." => ["verified chain"],
      "Cert Viewer 不上传证书，但显示 verified chain。" => ["verified chain"],
      "MCP is supported by Cert Viewer." => ["MCP integration"],
      "MCP is not supported by Cert Viewer." => [],
      "The certificate chain is verified by Cert Viewer." => ["chain validation"],
      "The certificate chain is not verified by Cert Viewer." => [],
      "A trusted certificate is returned by Cert Viewer." => ["trust decision"],
      "A trusted certificate is not returned by Cert Viewer." => [],
      "The hostname is verified by Cert Viewer." => ["hostname verification"],
      "The hostname is not verified by Cert Viewer." => [],
      "Cert Viewer matches the hostname." => ["hostname verification"],
      "Cert Viewer provides\nhostname verification." => ["hostname verification"],
      "Cert Viewer 返回可信证书。" => ["trust decision"],
      "Cert Viewer 不返回可信证书。" => [],
      "Cert Viewer 返回已验证的证书链。" => ["verified chain"],
      "Cert Viewer 不返回已验证的证书链。" => []
    }

    cases.each do |text, expected|
      assert_equal expected, unsupported_capability_claims(text), text
    end
  end
end
