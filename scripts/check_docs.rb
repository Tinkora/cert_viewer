#!/usr/bin/env ruby

require "json"
require "open3"
require "pathname"
require "rbconfig"

ROOT = Pathname.new(__dir__).join("..").expand_path

BILINGUAL_PAIRS = {
  "README.md" => "README.zh-CN.md",
  "CODE_OF_CONDUCT.md" => "CODE_OF_CONDUCT.zh-CN.md",
  "CONTRIBUTING.md" => "CONTRIBUTING.zh-CN.md",
  "SECURITY.md" => "SECURITY.zh-CN.md",
  "SUPPORT.md" => "SUPPORT.zh-CN.md"
}.freeze

CAPABILITY_MARKERS = [
  "Human-usable",
  "Machine-readable",
  "Agent schema draft",
  "Not Agent-callable"
].freeze

CAPABILITY_TABLE = <<~MARKDOWN.freeze
  | Capability | Current surface |
  | --- | --- |
  | Human-usable | Browser UI |
  | Machine-readable | Versioned JSON result |
  | Agent schema draft | Published JSON Schema |
  | Not Agent-callable | No transport or integration |
MARKDOWN

EXPECTED_CODEOWNERS = <<~CODEOWNERS.freeze
  * @tinkeragora
  /.github/ @tinkeragora
  /crates/ @tinkeragora
  /docs/schema/ @tinkeragora
  /web/ @tinkeragora
CODEOWNERS

REQUIRED_FILES = (%w[
  LICENSE
  CHANGELOG.md
  CITATION.cff
  THIRD_PARTY_NOTICES.md
  docs/RELEASING.md
  docs/SELF_HOSTING.md
  docs/decisions/0001-browser-first-local-only.md
  docs/decisions/0002-inspection-only-terminology.md
  docs/schema/README.md
  docs/schema/inspection-result-v1.example.json
  docs/schema/inspection-result-v1.schema.json
  scripts/check_docs_test.rb
  scripts/parse_markdown.mjs
  .github/CODEOWNERS
  .github/ISSUE_TEMPLATE/bug.yml
  .github/ISSUE_TEMPLATE/feature.yml
  .github/ISSUE_TEMPLATE/question.yml
  .github/ISSUE_TEMPLATE/config.yml
  .github/PULL_REQUEST_TEMPLATE.md
] + BILINGUAL_PAIRS.flatten).uniq.freeze

OBSOLETE_FILES = %w[
  .github/ISSUE_TEMPLATE/bug_report.md
  .github/ISSUE_TEMPLATE/feature_request.md
  docs/product_spec.zh-CN.md
  skills/cert_viewer.md
  skills/mcp-tools.json
].freeze

CAPABILITY_FILES = %w[README.md README.zh-CN.md].freeze
TEXT_EXTENSIONS = %w[.cff .json .jsonc .md .mjs .rb .toml .yml .yaml].freeze
MARKDOWN_HELPER = ROOT.join("scripts/parse_markdown.mjs")
MARKDOWN_PARSE_CACHE = {}
NEGATION_PATTERN = /(?:\b(?:no|not|never|neither|without|doesn't|does\s+not|cannot|can't|isn't|is\s+not)\b|不|不得|不能|不会|没有|并非|未)/i
CLAUSE_BOUNDARY = /[.!?;。！？；]/
CLAIM_CONTRAST_BOUNDARY = /\b(?:but|however|whereas)\b|但是|但|不过|却/i
EXPIRING_SOON_NEGATION_PATTERN = /(?:\b(?:does\s+not|doesn't|cannot|can't|never)\s+(?:expose|include|provide|report|show|offer|define|list|use|have)\b.{0,48}\bexpiring soon\b|\bno\b.{0,24}\bexpiring soon\b|\bexpiring soon\b.{0,24}\b(?:is|are)\s+not\b|没有.{0,24}即将到期|(?:不|未)(?:暴露|包含|提供|报告|显示|定义|列出|使用|存在).{0,24}即将到期)/i
VERIFIED_CHAIN_NEGATION_PATTERN = /(?:\bno\s+inference\b.{0,120}\bverified chains?\b|\b(?:do|does)\s+not\s+(?:describe|decide|state|claim|assert|infer|treat|present|show|return|form)\b.{0,280}\bverified chains?\b|\bnot\s+(?:asserted|described|claimed|treated|presented|shown|returned|formed)\b.{0,80}\bverified chains?\b|(?:不|不得)(?:推断|判断|声称|表示|认定|断言|显示|呈现|返回|形成).{0,200}\bverified chains?\b|(?:不|没有|未)(?:显示|呈现|返回|形成).{0,60}(?:已验证|可信)的?证书链)/i
CAPABILITY_CLAIM_RULES = [
  [
    "MCP integration",
    /(?:\b(?:has|supports?|provides?|offers?|includes?|exposes?|runs?|ships?)\b.{0,50}\bMCP\b|\bMCP\b.{0,30}\b(?:server|integration|tool|endpoint)\b.{0,20}\b(?:is|are)\s+(?:available|supported|provided|exposed)|\bMCP\b.{0,30}\b(?:is|are)\s+(?:supported|provided|offered|included|exposed|available)\s+by\b|(?:拥有|支持|提供|包含|暴露|运行|发布).{0,30}\bMCP\b)/i,
    /(?:\b(?:does\s+not|doesn't|cannot|can't|never)\s+(?:have|support|provide|offer|include|expose|run|ship)\b.{0,50}\bMCP\b|\bno\b.{0,30}\bMCP\b.{0,30}\b(?:is|are)?\s*(?:available|supported|provided|exposed)?|\bMCP\b.{0,30}\b(?:is|are)\s+not\s+(?:supported|provided|offered|included|exposed|available)\s+by\b|没有.{0,30}\bMCP\b|(?:不(?:会|能)?|没有|未)(?:支持|提供|包含|暴露|运行|发布|拥有).{0,30}\bMCP\b)/i
  ],
  [
    "chain validation",
    /(?:\b(?:checks?|validates?|verifies?|builds?|establishes?|provides?)\b.{0,50}\b(?:an?\s+)?(?:certificate\s+)?chains?\b|\b(?:certificate\s+)?chains?\b.{0,30}\b(?:is|are)\s+(?:checked|validated|verified|built|established)\s+by\b|(?<!已)(?:检查|验证|校验|建立|构建|提供).{0,30}(?:证书链|认证路径))/i,
    /(?:\b(?:does\s+not|doesn't|cannot|can't|never)\s+(?:check|validate|verify|build|establish|provide)\b.{0,50}\b(?:an?\s+)?(?:certificate\s+)?chains?\b|\b(?:certificate\s+)?chains?\b.{0,30}\b(?:is|are)\s+not\s+(?:checked|validated|verified|built|established)\s+by\b|(?:不(?:会|能)?|没有|未)(?:检查|验证|校验|建立|构建|提供).{0,30}(?:证书链|认证路径))/i
  ],
  [
    "trust decision",
    /(?:\b(?:validates?|verifies?|establishes?|provides?|makes?|performs?|returns?)\b.{0,50}\btrust(?:ed|\s+(?:decisions?|validation|conclusions?))?\b|\bdecides?\b.{0,50}\btrust(?:ed)?\b|\btrusted\s+certificates?\b.{0,30}\b(?:is|are)\s+(?:returned|provided)\s+by\b|(?:验证|校验|建立|提供|做出|执行|返回|判断).{0,30}(?:信任|可信)(?:决策|判断|结论|证书)?)/i,
    /(?:\b(?:does\s+not|doesn't|cannot|can't|never)\s+(?:validate|verify|establish|provide|make|perform|return|decide)\b.{0,50}\btrust(?:ed|\s+(?:decisions?|validation|conclusions?))?\b|\bmakes?\s+no\b.{0,50}\btrust(?:ed|\s+(?:decisions?|validation|conclusions?))?\b|\btrusted\s+certificates?\b.{0,30}\b(?:is|are)\s+not\s+(?:returned|provided)\s+by\b|(?:不(?:会|能)?|没有|未)(?:验证|校验|建立|提供|做出|执行|返回|判断).{0,30}(?:信任|可信)(?:决策|判断|结论|证书)?)/i
  ],
  [
    "hostname verification",
    /(?:\b(?:checks?|validates?|verifies?|provides?|performs?|offers?|matches?)\b.{0,50}\bhostname(?:s|\s+(?:verification|validation|checks?))?\b|\bhostnames?\b.{0,30}\b(?:is|are)\s+(?:checked|validated|verified|matched)\s+by\b|(?:检查|验证|校验|提供|执行|匹配).{0,30}(?:hostname|主机名))/i,
    /(?:\b(?:does\s+not|doesn't|cannot|can't|never)\s+(?:check|validate|verify|provide|perform|offer|match)\b.{0,50}\bhostname(?:s|\s+(?:verification|validation|checks?))?\b|\bhostnames?\b.{0,30}\b(?:is|are)\s+not\s+(?:checked|validated|verified|matched)\s+by\b|(?:不(?:会|能)?|没有|未)(?:检查|验证|校验|提供|执行|匹配).{0,30}(?:hostname|主机名))/i
  ],
  [
    "verified chain",
    /(?:\b(?:verified|validated|trusted)\s+(?:certificate\s+)?chains?\b|(?:显示|呈现|返回|形成).{0,60}(?:已验证|可信)的?证书链)/i,
    VERIFIED_CHAIN_NEGATION_PATTERN
  ]
].freeze

def within_root?(path, root)
  path == root || path.to_s.start_with?("#{root}#{File::SEPARATOR}")
end

def display_path(path, root)
  expanded = path.expand_path
  root_expanded = root.expand_path
  return expanded.relative_path_from(root_expanded).to_s if within_root?(expanded, root_expanded)

  expanded.to_s
end

def validate_regular_file(path, root, errors, context: nil, missing: true)
  path = path.expand_path
  root = root.expand_path
  label = context || display_path(path, root)

  unless within_root?(path, root)
    errors << "#{label}: path escapes repository"
    return nil
  end

  begin
    stat = path.lstat
  rescue Errno::ENOENT, Errno::ENOTDIR => error
    errors << "#{label}: #{missing ? 'missing file' : "unreadable path (#{error.class})"}"
    return nil
  rescue SystemCallError => error
    errors << "#{label}: cannot inspect file (#{error.class})"
    return nil
  end

  if stat.symlink?
    errors << "#{label}: symlink is not allowed"
    return nil
  end
  unless stat.file?
    errors << "#{label}: expected a regular file"
    return nil
  end

  current = root
  path.relative_path_from(root).each_filename do |part|
    current = current.join(part)
    next if current == path

    begin
      if current.lstat.symlink?
        errors << "#{label}: parent path contains a symlink"
        return nil
      end
    rescue SystemCallError => error
      errors << "#{label}: cannot inspect parent path (#{error.class})"
      return nil
    end
  end

  begin
    root_real = root.realpath
    path_real = path.realpath
  rescue SystemCallError => error
    errors << "#{label}: cannot resolve canonical path (#{error.class})"
    return nil
  end
  unless within_root?(path_real, root_real)
    errors << "#{label}: resolves outside repository"
    return nil
  end

  path
end

def validate_required_file(root, name, errors)
  validate_regular_file(root.join(name), root, errors, context: "required file #{name}")
end

def read_utf8(path, errors, root = ROOT)
  path = validate_regular_file(path, root, errors)
  return nil unless path

  bytes = path.binread
  if bytes.start_with?("\xEF\xBB\xBF".b)
    errors << "#{display_path(path, root)}: UTF-8 BOM is not allowed"
    return nil
  end

  text = bytes.force_encoding(Encoding::UTF_8)
  unless text.valid_encoding?
    errors << "#{display_path(path, root)}: content is not valid UTF-8"
    return nil
  end

  text
rescue SystemCallError => error
  errors << "#{display_path(path, root)}: cannot read file (#{error.class})"
  nil
end

def parse_markdown(text, source, errors, helper: MARKDOWN_HELPER)
  cache_key = [helper.to_s, text]
  return MARKDOWN_PARSE_CACHE[cache_key] if MARKDOWN_PARSE_CACHE.key?(cache_key)

  stdout, stderr, status = Open3.capture3(
    "node",
    helper.to_s,
    stdin_data: JSON.generate({ markdown: text })
  )
  unless status.success?
    detail = stderr.lines.first&.strip || "exit status #{status.exitstatus}"
    errors << "#{source}: Markdown parser failed: #{detail}"
    return nil
  end

  result = JSON.parse(stdout)
  unless result.is_a?(Hash) && %w[links anchors paragraphs].all? { |key| result[key].is_a?(Array) } &&
      %w[links anchors paragraphs].all? { |key| result[key].all? { |value| value.is_a?(String) } }
    errors << "#{source}: Markdown parser returned an invalid result"
    return nil
  end

  MARKDOWN_PARSE_CACHE[cache_key] = result
rescue Errno::ENOENT => error
  errors << "#{source}: Markdown parser is unavailable (#{error.message})"
  nil
rescue JSON::GeneratorError, JSON::ParserError, TypeError => error
  errors << "#{source}: Markdown parser failed (#{error.class}: #{error.message})"
  nil
end

def markdown_link_targets(text, source, errors)
  parse_markdown(text, source, errors)&.fetch("links", []) || []
end

def percent_decode(value, source, errors)
  if value.match?(/%(?![0-9a-f]{2})/i)
    errors << "#{source}: malformed percent-encoding in Markdown link fragment"
    return nil
  end
  bytes = value.gsub(/%([0-9a-f]{2})/i) { [$1.to_i(16)].pack("C") }
  text = bytes.force_encoding(Encoding::UTF_8)
  unless text.valid_encoding?
    errors << "#{source}: Markdown link contains invalid UTF-8 percent-encoding"
    return nil
  end
  text
end

def external_markdown_target?(target)
  target.start_with?("//", "mailto:") || target.match?(/\A[a-z][a-z0-9+.-]*:/i)
end

def github_heading_anchors(text, source, errors)
  anchors = parse_markdown(text, source, errors)&.fetch("anchors", []) || []
  anchors.to_h { |anchor| [anchor, true] }
end

def markdown_claim_paragraphs(text, source, errors)
  parse_markdown(text, source, errors)&.fetch("paragraphs", []) || []
end

def validate_anchor(target_path, fragment, root, source, errors)
  return if fragment.nil? || fragment.empty?

  unless target_path.file?
    errors << "#{source}: cannot validate Markdown anchor on non-file target: #{target_path}"
    return
  end
  text = read_utf8(target_path, errors, root)
  return unless text

  anchors = github_heading_anchors(text, source, errors)
  errors << "#{source}: missing Markdown anchor: #{fragment}" unless anchors.key?(fragment)
end

def validate_markdown_links(path, root, errors)
  text = read_utf8(path, errors, root)
  return unless text

  markdown_link_targets(text, display_path(path, root), errors).each do |raw_target|
    target = raw_target.strip
    next if target.empty? || external_markdown_target?(target)

    path_and_query, raw_fragment = target.split("#", 2)
    raw_path = path_and_query.split("?", 2).first || ""
    decoded_path = percent_decode(raw_path, display_path(path, root), errors)
    decoded_fragment = raw_fragment.nil? ? nil : percent_decode(raw_fragment, display_path(path, root), errors)
    next if decoded_path.nil? || (raw_fragment && decoded_fragment.nil?)

    target_path = decoded_path.empty? ? path : path.dirname.join(decoded_path).cleanpath.expand_path
    unless within_root?(target_path, root.expand_path)
      errors << "#{display_path(path, root)}: local link escapes repository: #{target}"
      next
    end

    unless target_path.exist?
      errors << "#{display_path(path, root)}: broken local link: #{target}"
      next
    end

    begin
      canonical = target_path.realpath
      unless within_root?(canonical, root.realpath)
        errors << "#{display_path(path, root)}: local link resolves outside repository: #{target}"
        next
      end
    rescue SystemCallError => error
      errors << "#{display_path(path, root)}: cannot resolve local link #{target} (#{error.class})"
      next
    end

    validate_anchor(target_path, decoded_fragment, root, "#{display_path(path, root)}: #{target}", errors)
  end
rescue StandardError => error
  errors << "#{display_path(path, root)}: Markdown link parsing failed (#{error.class}: #{error.message})"
end

def affirmative_claim?(line, pattern, negative_pattern = nil)
  line.split(CLAUSE_BOUNDARY).any? do |clause|
    clause.split(CLAIM_CONTRAST_BOUNDARY).any? do |segment|
      matches = []
      segment.scan(pattern) do
        match = Regexp.last_match
        matches << [match.begin(0), match.end(0)]
      end
      negative_matches = []
      if negative_pattern
        segment.scan(negative_pattern) do
          match = Regexp.last_match
          negative_matches << [match.begin(0), match.end(0)]
        end
      end

      matches.any? do |start_at, end_at|
        if negative_pattern
          next negative_matches.none? { |negative_start, negative_end| negative_start < end_at && start_at < negative_end }
        end

        context_start = [start_at - 48, 0].max
        context_end = [end_at + 32, segment.length].min
        !segment[context_start...context_end].match?(NEGATION_PATTERN)
      end
    end
  end
end

def unsupported_capability_claims(line)
  line = line.gsub(/\s+/, " ").strip
  CAPABILITY_CLAIM_RULES.filter_map do |label, positive, negative|
    label if affirmative_claim?(line, positive, negative)
  end
end

def unsupported_expiring_soon_claim?(line)
  affirmative_claim?(line, /expiring soon|即将到期/i, EXPIRING_SOON_NEGATION_PATTERN)
end

def unsupported_normalized_self_issued_claim?(line)
  normalized_dn = /\bnormalized\b.{0,80}(?:distinguished names?|DNs?)\b/i
  association = /(?:\bis_self_issued\b.{0,160}#{normalized_dn}|#{normalized_dn}.{0,160}\bis_self_issued\b)/i
  relation_verbs = /(?:use|mean|represent|compare|perform|normalize|describe)/i
  negative = /(?:\bis_self_issued\b.{0,60}(?:\bis\s+not\b|\bisn't\b|\b(?:does\s+not|doesn't|never)\s+#{relation_verbs}\b|\bhas\s+no\b|不是|并非|不(?:会)?(?:使用|表示|代表|比较|执行)|没有(?:使用|采用|执行)).{0,80}#{normalized_dn}|#{normalized_dn}.{0,80}(?:\bis\s+not\b|\bisn't\b|不是|并非).{0,60}\bis_self_issued\b)/i
  continuation = /^\s*,?\s*(?:and\s+)?(?:uses?|means?|represents?|compares?|performs?|normalizes?|describes?)\b.{0,80}#{normalized_dn}/i

  line.split(CLAUSE_BOUNDARY).any? do |clause|
    segments = clause.split(CLAIM_CONTRAST_BOUNDARY)
    segments.each_with_index.any? do |segment, index|
      if segment.match?(association)
        affirmative_claim?(segment, normalized_dn, negative)
      elsif index.positive? && segment.match?(continuation) && segments.first(index).any? { |prior| prior.match?(/\bis_self_issued\b/i) }
        affirmative_claim?("is_self_issued #{segment}", normalized_dn, negative)
      else
        false
      end
    end
  end
end

def documentation_errors(root)
  root = root.expand_path
  errors = []

  REQUIRED_FILES.each { |name| validate_required_file(root, name, errors) }
  OBSOLETE_FILES.each do |name|
    errors << "obsolete public file must be removed: #{name}" if root.join(name).exist?
  end

  text_files = root.glob("**/*", File::FNM_DOTMATCH).select do |path|
    next false if path.to_s.include?("/.git/") || path.to_s.include?("/node_modules/") || path.to_s.include?("/target/")
    next false unless TEXT_EXTENSIONS.include?(path.extname) || %w[LICENSE CODEOWNERS].include?(path.basename.to_s)

    begin
      !path.lstat.directory?
    rescue SystemCallError
      true
    end
  end

  text_files.each do |path|
    text = read_utf8(path, errors, root)
    next unless text && path.extname == ".md"

    validate_markdown_links(path, root, errors)
  end

  BILINGUAL_PAIRS.each do |english_name, chinese_name|
    english = read_utf8(root.join(english_name), errors, root)
    chinese = read_utf8(root.join(chinese_name), errors, root)
    next unless english && chinese

    errors << "#{english_name}: first 12 lines must link to #{chinese_name}" unless english.lines.first(12).join.include?("](#{chinese_name})")
    errors << "#{chinese_name}: first 12 lines must link to #{english_name}" unless chinese.lines.first(12).join.include?("](#{english_name})")
  end

  CAPABILITY_FILES.each do |name|
    text = read_utf8(root.join(name), errors, root)
    next unless text

    CAPABILITY_MARKERS.each do |marker|
      errors << "#{name}: missing capability marker: #{marker}" unless text.include?(marker)
    end
    errors << "#{name}: capability table does not match the public contract" unless text.include?(CAPABILITY_TABLE)
  end

  { "README.md" => "select **Inspect**", "README.zh-CN.md" => "选择 **检查**" }.each do |name, action|
    text = read_utf8(root.join(name), errors, root)
    next unless text

    errors << "#{name}: quick start must use the current action label: #{action}" unless text.include?(action)
  end

  codeowners = read_utf8(root.join(".github/CODEOWNERS"), errors, root)
  if codeowners && codeowners != EXPECTED_CODEOWNERS
    errors << ".github/CODEOWNERS: content does not match the repository ownership contract"
  end

  product_files = text_files.select do |path|
    name = display_path(path, root)
    next false if name.start_with?("docs/superpowers/")

    name.start_with?(".github/", "docs/") ||
      path.dirname == root && !%w[AGENTS.md .markdownlint-cli2.jsonc].include?(name)
  end

  product_files.each do |path|
    text = read_utf8(path, errors, root)
    next unless text

    name = display_path(path, root)
    errors << "#{name}: uses the removed is_self_signed field" if text.match?(/\bis_self_signed\b/)

    paragraphs = if path.extname == ".md"
      markdown_claim_paragraphs(text, name, errors)
    else
      text.split(/\n\s*\n/).map { |paragraph| paragraph.gsub(/\s+/, " ").strip }.reject(&:empty?)
    end
    paragraphs.each_with_index do |paragraph, index|
      errors << "#{name}:paragraph #{index + 1}: claims an unsupported expiring-soon date state" if unsupported_expiring_soon_claim?(paragraph)
      if unsupported_normalized_self_issued_claim?(paragraph)
        errors << "#{name}:paragraph #{index + 1}: incorrectly describes is_self_issued as normalized-DN comparison"
      end
      unsupported_capability_claims(paragraph).each do |label|
        errors << "#{name}:paragraph #{index + 1}: unsupported #{label} claim"
      end
    end
  end

  claim_guard_cases = [
    [:unsupported_expiring_soon_claim?, "Cert Viewer does not expose an expiring soon state.", false],
    [:unsupported_expiring_soon_claim?, "日期状态没有即将到期这一项。", false],
    [:unsupported_expiring_soon_claim?, "Date states include expiring soon.", true],
    [:unsupported_expiring_soon_claim?, "Cert Viewer does not verify trust but date states include expiring soon.", true],
    [:unsupported_expiring_soon_claim?, "Cert Viewer does not verify trust and reports expiring soon.", true],
    [:unsupported_normalized_self_issued_claim?, "is_self_issued is not a normalized distinguished name comparison.", false],
    [:unsupported_normalized_self_issued_claim?, "is_self_issued is not a normalized DN comparison, but display code documents normalized DN formatting.", false],
    [:unsupported_normalized_self_issued_claim?, "is_self_issued 不会使用 normalized DN comparison。", false],
    [:unsupported_normalized_self_issued_claim?, "is_self_issued uses a normalized DN comparison.", true],
    [:unsupported_normalized_self_issued_claim?, "is_self_issued does not verify signatures but uses normalized DNs.", true],
    [:unsupported_normalized_self_issued_claim?, "is_self_issued does not verify signatures and uses normalized DNs.", true],
    [:unsupported_normalized_self_issued_claim?, "Display code documents normalized DN formatting.", false]
  ].freeze
  claim_guard_cases.each do |predicate, example, expected|
    actual = send(predicate, example)
    errors << "claim guard regression: #{predicate} returned #{actual.inspect} for #{example.inspect}" unless actual == expected
  end

  changelog = read_utf8(root.join("CHANGELOG.md"), errors, root)
  if changelog
    release_headings = changelog.scan(/^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}$/)
    expected = "## [0.1.2] - 2026-08-15"
    errors << "CHANGELOG.md: newest release heading must be #{expected}" unless release_headings.first == expected
  end

  [errors.uniq.sort, text_files.length]
end

def run_regression_suite(root, stdout:, stderr:)
  test_path = root.join("scripts/check_docs_test.rb")
  output, error_output, status = Open3.capture3(
    RbConfig.ruby,
    test_path.to_s,
    chdir: root.to_s
  )
  stdout.write(output)
  stderr.write(error_output)
  stderr.puts "Documentation regression suite failed." unless status.success?
  status.success?
rescue SystemCallError => error
  stderr.puts "Documentation regression suite could not start (#{error.class}: #{error.message})."
  false
end

def run(root = ROOT, stdout: $stdout, stderr: $stderr)
  tests_passed = run_regression_suite(root, stdout: stdout, stderr: stderr)
  errors, text_count = documentation_errors(root)
  if errors.empty?
    stdout.puts "Documentation checks passed (#{text_count} UTF-8 text files checked)."
    tests_passed
  else
    stderr.puts "Documentation checks failed:"
    errors.each { |error| stderr.puts "- #{error}" }
    false
  end
end

exit 1 if __FILE__ == $PROGRAM_NAME && !run
